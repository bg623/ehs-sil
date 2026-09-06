/**
 * EHS-SIL membership client.
 *
 * Authorization is always decided by the Worker. Browser state and the local
 * display nickname are presentation aids only and never grant capabilities.
 */
(function () {
    'use strict';

    var API_BASE = 'https://vip-api.ehs-sil.com/api/vip';
    var NICKNAME_KEY = 'ehs_display_nickname_v1';
    var REFRESH_KEY = 'ehs_membership_refresh_v1';
    var CACHE_MS = 60 * 1000;
    var FOREGROUND_REFRESH_MS = 5 * 60 * 1000;
    var REQUEST_TIMEOUT_MS = 12000;
    var cachedState = { ok: true, active: false, status: 'checking', capabilities: [] };
    var checkedAt = 0;
    var inFlight = null;
    var listeners = [];
    var channel = null;

    function membershipError(message, code, httpStatus) {
        var error = new Error(message || '服务暂时不可用，请稍后再试');
        error.code = code || 'MEMBERSHIP_REQUEST_FAILED';
        error.httpStatus = Number(httpStatus || 0);
        return error;
    }

    async function request(path, options) {
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timeout = controller ? setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS) : null;
        var response;
        try {
            response = await fetch(API_BASE + path, Object.assign({
                credentials: 'include',
                headers: { 'Accept': 'application/json' },
                signal: controller ? controller.signal : undefined
            }, options || {}));
        } catch (error) {
            if (timeout) clearTimeout(timeout);
            throw membershipError(
                error && error.name === 'AbortError' ? '权益验证超时，请重试' : '权益服务暂时无法连接，请重试',
                error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'
            );
        }
        if (timeout) clearTimeout(timeout);

        var payload;
        try {
            payload = await response.json();
        } catch (error) {
            payload = { ok: false, message: '权益服务返回了无法识别的结果' };
        }
        if (!response.ok) {
            throw membershipError(payload.message || '请求失败，请稍后再试', payload.code || 'HTTP_ERROR', response.status);
        }
        return payload;
    }

    function normalizeSession(payload) {
        payload = payload || {};
        var supported = ['inactive', 'active', 'expired', 'revoked'];
        var status = payload.active ? 'active' : String(payload.status || 'inactive');
        if (supported.indexOf(status) < 0) status = 'inactive';
        return {
            ok: payload.ok !== false,
            active: status === 'active',
            status: status,
            label: payload.label || '',
            member_status: payload.member_status || payload.entitlement_source || '',
            entitlement_source: payload.entitlement_source || payload.member_status || '',
            starts: payload.starts || '',
            expires: payload.expires || '',
            renewal_status: payload.renewal_status || '',
            capabilities: Array.isArray(payload.capabilities) ? payload.capabilities.slice() : []
        };
    }

    function publish(state) {
        cachedState = state;
        listeners.slice().forEach(function (listener) {
            try { listener(state); } catch (error) { /* UI listeners must not block membership. */ }
        });
        window.dispatchEvent(new CustomEvent('ehs-sil:membership-state', { detail: state }));
    }

    function broadcastRefresh() {
        if (channel) channel.postMessage({ type: 'refresh' });
        try { localStorage.setItem(REFRESH_KEY, String(Date.now())); } catch (error) { /* Optional fallback only. */ }
    }

    async function getVipInfo(forceRefresh) {
        var now = Date.now();
        if (!forceRefresh && inFlight) return inFlight;
        if (!forceRefresh && cachedState.status !== 'checking' && cachedState.status !== 'error' && checkedAt && now - checkedAt < CACHE_MS) {
            return cachedState;
        }
        if (cachedState.status === 'checking' || forceRefresh) {
            publish(Object.assign({}, cachedState, { status: 'checking' }));
        }
        inFlight = request('/session')
            .then(function (payload) {
                checkedAt = Date.now();
                var state = normalizeSession(payload);
                publish(state);
                return state;
            })
            .catch(function (error) {
                checkedAt = 0;
                var state = {
                    ok: false,
                    active: false,
                    status: 'error',
                    capabilities: [],
                    message: error.message,
                    error_code: error.code || 'MEMBERSHIP_REQUEST_FAILED'
                };
                publish(state);
                if (window.EhsSilAnalytics) {
                    window.EhsSilAnalytics.track('membership_status_error', {
                        pageType: 'membership',
                        errorType: state.error_code === 'TIMEOUT' ? 'timeout' : 'network'
                    });
                }
                return state;
            })
            .finally(function () { inFlight = null; });
        return inFlight;
    }

    async function isVip() {
        var session = await getVipInfo();
        return Boolean(session && session.active);
    }

    async function activateVip(code) {
        var normalized = String(code || '').trim();
        if (!normalized) throw membershipError('请输入激活码', 'INVALID_CODE');
        await request('/activate', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: normalized })
        });
        checkedAt = 0;
        var confirmed = await getVipInfo(true);
        if (!confirmed.active) {
            var error = membershipError(
                '激活请求已处理，但当前浏览器尚未确认权益。请使用“重新验证权益”，不要重复提交激活码。',
                'ACTIVATION_UNCONFIRMED'
            );
            error.activationProcessed = true;
            throw error;
        }
        try { localStorage.removeItem(NICKNAME_KEY); } catch (error) { /* Optional preference only. */ }
        broadcastRefresh();
        if (window.EhsSilAnalytics) window.EhsSilAnalytics.track('activation_verified', { pageType: 'membership' });
        return confirmed;
    }

    async function hasCapability(capability, forceRefresh) {
        var session = await getVipInfo(Boolean(forceRefresh));
        return Boolean(session && session.active && Array.isArray(session.capabilities) && session.capabilities.indexOf(capability) >= 0);
    }

    async function clearVip() {
        await request('/logout', { method: 'POST', headers: { 'Accept': 'application/json' } });
        try { localStorage.removeItem(NICKNAME_KEY); } catch (error) { /* Optional preference only. */ }
        checkedAt = Date.now();
        publish(normalizeSession({ ok: true, active: false, status: 'inactive' }));
        broadcastRefresh();
        return true;
    }

    function gateMarkup(status) {
        var statusMessage = '';
        if (status === 'expired') statusMessage = '<p class="membership-gate-note">原权益已到期，可续期后使用新的激活码。</p>';
        if (status === 'revoked') statusMessage = '<p class="membership-gate-note">当前权益已失效。如有疑问，请使用会员问题反馈。</p>';
        return '<div class="membership-gate">' +
            '<div class="membership-gate-icon">&#11088;</div>' +
            '<h3>工具箱会员专业内容</h3>' + statusMessage +
            '<p>激活码由安全服务器验证，浏览器不会保存激活码。</p>' +
            '<form id="vipGateForm" class="membership-gate-form">' +
            '<label for="gateCode" class="visually-hidden">会员激活码</label>' +
            '<input id="gateCode" name="code" type="password" autocomplete="one-time-code" placeholder="输入激活码" required>' +
            '<button type="submit" class="btn btn-primary">激活</button>' +
            '</form>' +
            '<div id="gateMsg" role="status" aria-live="polite" class="membership-gate-message"></div>' +
            '<div class="membership-gate-links"><a href="/dashboard/register.html">查看会员权益</a> · <a href="/feedback.html?type=membership" data-feedback-open>反馈会员问题</a></div>' +
            '</div>';
    }

    async function renderSimpleGate(containerId, options) {
        var element = document.getElementById(containerId);
        if (!element) return false;
        element.innerHTML = '<div class="membership-loading" role="status">正在验证会员状态…</div>';
        var session = await getVipInfo(Boolean(options && options.forceRefresh));
        if (session.active) {
            element.innerHTML = '<div class="membership-confirmed"><h3>✓ 会员权益已验证</h3><p>' +
                escapeHtml(session.label || membershipName(session)) + ' · ' + formatExpiry(session.expires) + '</p></div>';
            if (options && options.contentId) {
                var content = document.getElementById(options.contentId);
                if (content) content.style.display = 'block';
            }
            return true;
        }
        if (session.status === 'error') {
            element.innerHTML = '<div class="membership-error" role="status"><strong>权益暂未确认</strong><p>' +
                escapeHtml(session.message || '权益服务暂时不可用') +
                '</p><button type="button" class="btn btn-secondary" data-membership-retry>重新验证权益</button></div>';
            var retry = element.querySelector('[data-membership-retry]');
            if (retry) retry.addEventListener('click', function () { renderSimpleGate(containerId, { forceRefresh: true }); });
            return false;
        }
        element.innerHTML = gateMarkup(session.status);
        var form = document.getElementById('vipGateForm');
        if (form) form.addEventListener('submit', doGateActivate);
        return false;
    }

    async function doGateActivate(event) {
        if (event) event.preventDefault();
        var form = event && event.currentTarget;
        var input = form && form.querySelector('#gateCode');
        var message = form && form.parentElement.querySelector('#gateMsg');
        var button = form && form.querySelector('button[type="submit"]');
        if (!input || !message) return;
        message.textContent = '正在验证…';
        message.className = 'membership-gate-message is-visible';
        if (button) button.disabled = true;
        try {
            var result = await activateVip(input.value);
            input.value = '';
            message.className = 'membership-gate-message is-visible is-success';
            message.textContent = '会员权益已确认，' + formatExpiry(result.expires) + '。';
        } catch (error) {
            message.className = 'membership-gate-message is-visible is-error';
            message.textContent = error.message;
            if (button) button.disabled = false;
        }
    }

    function safeReturnTo(value) {
        if (!value || /[\\\u0000-\u001F]/.test(value) || /^\/\//.test(value)) return '';
        try {
            var parsed = new URL(value, window.location.origin);
            if (parsed.origin !== window.location.origin || parsed.search) return '';
            var allowed = /^(?:\/tools\/[a-z0-9-]+\.html|\/index\.html|\/)$/;
            if (!allowed.test(parsed.pathname)) return '';
            return parsed.pathname + (parsed.hash || '');
        } catch (error) {
            return '';
        }
    }

    function membershipName(session) {
        if (session && session.entitlement_source === 'legacy_vip') return '原网站 VIP 会员';
        if (session && session.entitlement_source === 'admin') return 'EHS-SIL 管理员';
        return '工具箱会员';
    }

    function formatExpiry(value) {
        if (!value) return '有效期以服务端记录为准';
        try {
            return '有效期至 ' + new Intl.DateTimeFormat('zh-CN', {
                timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
            }).format(new Date(value));
        } catch (error) {
            return '有效期至 ' + String(value).slice(0, 10);
        }
    }

    function escapeHtml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function subscribe(listener, immediate) {
        if (typeof listener !== 'function') return function () {};
        listeners.push(listener);
        if (immediate !== false) listener(cachedState);
        return function () {
            var index = listeners.indexOf(listener);
            if (index >= 0) listeners.splice(index, 1);
        };
    }

    function receiveRefresh() {
        checkedAt = 0;
        getVipInfo(true);
    }

    if (typeof BroadcastChannel === 'function') {
        channel = new BroadcastChannel('ehs-sil-membership-v1');
        channel.addEventListener('message', function (event) {
            if (event.data && event.data.type === 'refresh') receiveRefresh();
        });
    }
    window.addEventListener('storage', function (event) {
        if (event.key === REFRESH_KEY) receiveRefresh();
    });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && Date.now() - checkedAt > FOREGROUND_REFRESH_MS) receiveRefresh();
    });

    window.EhsSilVip = {
        activate: activateVip,
        clear: clearVip,
        getSession: getVipInfo,
        getState: function () { return cachedState; },
        hasCapability: hasCapability,
        isActive: isVip,
        refresh: function () { return getVipInfo(true); },
        renderGate: renderSimpleGate,
        request: request,
        safeReturnTo: safeReturnTo,
        subscribe: subscribe,
        membershipName: membershipName,
        formatExpiry: formatExpiry,
        nicknameKey: NICKNAME_KEY
    };

    window.activateVip = activateVip;
    window.clearVip = clearVip;
    window.getVipInfo = getVipInfo;
    window.isVip = isVip;
    window.checkVipStatus = isVip;
    window.renderSimpleGate = renderSimpleGate;
    window.doGateActivate = doGateActivate;
}());
