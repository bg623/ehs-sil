/**
 * EHS-SIL membership client
 *
 * Authorization is decided by /api/vip on the server. No activation codes,
 * passwords, expiry claims, or privileged content are stored in the browser.
 */
(function () {
    'use strict';

    var API_BASE = '/api/vip';
    var cachedSession = null;

    async function request(path, options) {
        var response = await fetch(API_BASE + path, Object.assign({
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json' }
        }, options || {}));

        var payload;
        try {
            payload = await response.json();
        } catch (error) {
            payload = { ok: false, message: '服务暂时不可用，请稍后再试' };
        }

        if (!response.ok) {
            throw new Error(payload.message || '请求失败，请稍后再试');
        }
        return payload;
    }

    async function getVipInfo(forceRefresh) {
        if (!forceRefresh && cachedSession) return cachedSession;
        try {
            cachedSession = await request('/session');
        } catch (error) {
            cachedSession = { ok: false, active: false, message: error.message };
        }
        return cachedSession;
    }

    async function isVip() {
        var session = await getVipInfo();
        return Boolean(session && session.active);
    }

    async function activateVip(code) {
        var normalized = String(code || '').trim();
        if (!normalized) throw new Error('请输入激活码');

        var payload = await request('/activate', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: normalized })
        });
        cachedSession = {
            ok: true,
            active: true,
            label: payload.label,
            expires: payload.expires
        };
        return payload;
    }

    async function clearVip() {
        await request('/logout', {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
        });
        cachedSession = { ok: true, active: false };
        location.reload();
    }

    function gateMarkup() {
        return '<div style="background:#fefce8;border:2px dashed #fde68a;border-radius:12px;padding:1.5rem 2rem;text-align:center;max-width:440px;margin:0 auto">' +
            '<div style="font-size:2.5rem;margin-bottom:.3rem">&#11088;</div>' +
            '<h3 style="font-size:1rem;color:#0d2836;margin-bottom:.3rem">工具箱会员专业内容</h3>' +
            '<p style="font-size:.82rem;color:#666;margin-bottom:1rem">激活码将由安全服务器验证，浏览器不会保存激活码。</p>' +
            '<form id="vipGateForm" style="display:flex;gap:.3rem;max-width:320px;margin:0 auto">' +
            '<label for="gateCode" style="position:absolute;left:-9999px">会员激活码</label>' +
            '<input id="gateCode" name="code" type="password" autocomplete="one-time-code" style="flex:1;min-width:0;padding:.5rem .6rem;border:1.5px solid #ddd;border-radius:6px;font-size:.82rem;outline:none" placeholder="输入激活码" required>' +
            '<button type="submit" style="padding:.5rem .8rem;background:#b8860b;color:#fff;border:none;border-radius:6px;font-size:.82rem;font-weight:500;cursor:pointer;white-space:nowrap">激活</button>' +
            '</form>' +
            '<div id="gateMsg" role="status" aria-live="polite" style="font-size:.78rem;margin-top:.5rem;display:none"></div>' +
            '<div style="font-size:.72rem;color:#999;margin-top:.7rem">还没有激活码？<a href="/dashboard/register.html" style="color:#b8860b">查看会员权益 →</a></div>' +
            '</div>';
    }

    async function renderSimpleGate(containerId, options) {
        var element = document.getElementById(containerId);
        if (!element) return false;

        element.innerHTML = '<div style="padding:1rem;text-align:center;color:#777;font-size:.82rem">正在验证会员状态…</div>';
        var session = await getVipInfo(Boolean(options && options.forceRefresh));

        if (session.active) {
            element.innerHTML = '<div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:1rem;margin-top:.8rem">' +
                '<h3 style="font-size:.85rem;color:#166534;margin-bottom:.3rem">&#10003; 会员权益已验证</h3>' +
                '<p style="font-size:.78rem;color:#333">' +
                escapeHtml(session.label || '工具箱会员') + ' · 有效期至 ' +
                escapeHtml(String(session.expires || '').slice(0, 10)) +
                '</p></div>';
            if (options && options.contentId) {
                var content = document.getElementById(options.contentId);
                if (content) content.style.display = 'block';
            }
            return true;
        }

        element.innerHTML = gateMarkup();
        var form = document.getElementById('vipGateForm');
        if (form) form.addEventListener('submit', doGateActivate);
        return false;
    }

    async function doGateActivate(event) {
        if (event) event.preventDefault();
        var input = document.getElementById('gateCode');
        var message = document.getElementById('gateMsg');
        var button = document.querySelector('#vipGateForm button[type="submit"]');
        if (!input || !message) return;

        message.style.display = 'block';
        message.style.color = '#666';
        message.textContent = '正在验证…';
        if (button) button.disabled = true;

        try {
            var result = await activateVip(input.value);
            input.value = '';
            message.style.color = '#166534';
            message.textContent = result.message || '激活成功，正在进入…';
            var returnTo = new URLSearchParams(location.search).get('returnTo');
            setTimeout(function () {
                location.href = safeReturnTo(returnTo) || location.pathname;
            }, 600);
        } catch (error) {
            message.style.color = '#b91c1c';
            message.textContent = error.message;
            if (button) button.disabled = false;
        }
    }

    function safeReturnTo(value) {
        if (!value || value.charAt(0) !== '/' || value.slice(0, 2) === '//') return '';
        return value;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    window.EhsSilVip = {
        activate: activateVip,
        clear: clearVip,
        getSession: getVipInfo,
        isActive: isVip,
        renderGate: renderSimpleGate
    };

    // Compatibility names for existing pages while they migrate.
    window.activateVip = activateVip;
    window.clearVip = clearVip;
    window.getVipInfo = getVipInfo;
    window.isVip = isVip;
    window.checkVipStatus = isVip;
    window.renderSimpleGate = renderSimpleGate;
    window.doGateActivate = doGateActivate;
}());
