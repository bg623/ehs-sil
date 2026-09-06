/** EHS-SIL shared membership presentation. Authorization remains server-side. */
(function () {
    'use strict';

    var vip = window.EhsSilVip;
    if (!vip) return;
    var nicknameKey = vip.nicknameKey || 'ehs_display_nickname_v1';
    var latestState = vip.getState();
    var capabilityLabels = {
        compliance_excel_export: '企业法规识别专业 Excel 导出',
        feedback_admin: '反馈处理后台（管理员）'
    };

    function readNickname() {
        try { return normalizeNickname(localStorage.getItem(nicknameKey)); } catch (error) { return ''; }
    }

    function normalizeNickname(value) {
        var text = String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
        return /^[\p{Script=Han}A-Za-z0-9 _·-]{2,20}$/u.test(text) ? text : '';
    }

    function saveNickname(value) {
        var nickname = normalizeNickname(value);
        if (!nickname) throw new Error('昵称请使用 2–20 个中文、英文或数字');
        try { localStorage.setItem(nicknameKey, nickname); } catch (error) { /* Current-page display still works. */ }
        return nickname;
    }

    function navLabel(state) {
        if (state.status === 'checking') return '正在确认权益…';
        if (state.status === 'error') return '权益暂未确认 · 重试';
        if (state.status === 'expired') return '权益已到期';
        if (state.status === 'revoked') return '权益已失效';
        if (state.active) {
            var nickname = readNickname();
            if (nickname) return nickname + ' · 已激活';
            if (state.entitlement_source === 'legacy_vip') return '会员权益已激活';
            return vip.membershipName(state) + ' · 已激活';
        }
        return '登录 / 激活权益';
    }

    function stateDescription(state) {
        if (state.status === 'checking') return '正在向安全服务器确认当前浏览器的会员权益。';
        if (state.status === 'error') return state.message || '暂时无法连接权益服务，请重试。免费工具仍可继续使用。';
        if (state.status === 'expired') return '服务端确认原权益已到期。免费工具仍可使用；续期后可重新激活专业权益。';
        if (state.status === 'revoked') return '服务端确认当前权益已失效。如有疑问，请提交会员问题反馈。';
        if (state.active) return vip.membershipName(state) + '已在当前浏览器生效。';
        return '当前浏览器尚未确认有效权益。已有激活码可在下方验证。';
    }

    function renderNav(state) {
        document.querySelectorAll('[data-membership-status]').forEach(function (element) {
            var label = navLabel(state);
            element.textContent = label;
            element.title = label;
            element.setAttribute('data-membership-state', state.status);
            element.classList.toggle('is-active', Boolean(state.active));
            element.classList.toggle('is-error', state.status === 'error');
        });
    }

    function renderDetails(state) {
        var panel = document.querySelector('[data-membership-detail]');
        if (!panel) return;
        var title = panel.querySelector('[data-membership-title]');
        var description = panel.querySelector('[data-membership-description]');
        var expiry = panel.querySelector('[data-membership-expiry]');
        var capabilities = panel.querySelector('[data-membership-capabilities]');
        var activeActions = panel.querySelector('[data-membership-active-actions]');
        var retry = panel.querySelector('[data-membership-retry]');
        var activateSection = document.querySelector('[data-membership-activate-section]');
        var nicknameSection = panel.querySelector('[data-nickname-section]');
        if (title) title.textContent = navLabel(state);
        if (description) description.textContent = stateDescription(state);
        if (expiry) {
            expiry.textContent = state.active && state.expires ? vip.formatExpiry(state.expires) : '';
            expiry.hidden = !expiry.textContent;
        }
        if (capabilities) {
            capabilities.innerHTML = '';
            (state.capabilities || []).forEach(function (capability) {
                if (!capabilityLabels[capability]) return;
                var item = document.createElement('li');
                item.textContent = capabilityLabels[capability];
                capabilities.appendChild(item);
            });
            capabilities.hidden = !state.active || !capabilities.children.length;
        }
        if (activeActions) activeActions.hidden = !state.active;
        if (nicknameSection) nicknameSection.hidden = !state.active;
        if (activateSection) activateSection.hidden = state.active || state.status === 'checking' || state.status === 'error';
        if (retry) retry.hidden = state.status !== 'error';
        panel.setAttribute('data-membership-state', state.status);
        var nicknameInput = panel.querySelector('[data-nickname-input]');
        if (nicknameInput && state.active) nicknameInput.value = readNickname();
        var adminLink = panel.querySelector('[data-feedback-admin-link]');
        if (adminLink) adminLink.hidden = !(state.capabilities || []).includes('feedback_admin');
    }

    function render(state) {
        latestState = state;
        renderNav(state);
        renderDetails(state);
    }

    function initialiseDetails() {
        var activationForm = document.querySelector('[data-membership-activation-form]');
        if (activationForm) activationForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            var input = activationForm.elements.code;
            var submit = activationForm.querySelector('[type="submit"]');
            var message = activationForm.querySelector('[data-activation-message]');
            var retrySession = activationForm.querySelector('[data-activation-session-retry]');
            if (!input || !input.value.trim()) return;
            submit.disabled = true;
            submit.textContent = '正在验证…';
            message.textContent = '';
            retrySession.hidden = true;
            try {
                var confirmed = await vip.activate(input.value);
                input.value = '';
                message.textContent = '会员权益已在当前浏览器确认，' + vip.formatExpiry(confirmed.expires) + '。你可以设置昵称或返回刚才的工具。';
            } catch (error) {
                message.textContent = error.message;
                if (error.activationProcessed) retrySession.hidden = false;
            } finally {
                submit.disabled = false;
                submit.textContent = '验证并激活';
            }
        });
        var activationRetry = document.querySelector('[data-activation-session-retry]');
        if (activationRetry) activationRetry.addEventListener('click', async function () {
            var message = document.querySelector('[data-activation-message]');
            activationRetry.disabled = true;
            if (message) message.textContent = '正在重新确认当前会话…';
            var state = await vip.refresh();
            if (message) message.textContent = state.active ? '会员权益已确认，' + vip.formatExpiry(state.expires) + '。' : stateDescription(state);
            activationRetry.disabled = false;
            activationRetry.hidden = state.active;
        });

        var nicknameForm = document.querySelector('[data-nickname-form]');
        if (nicknameForm) nicknameForm.addEventListener('submit', function (event) {
            event.preventDefault();
            var input = nicknameForm.querySelector('[data-nickname-input]');
            var message = nicknameForm.querySelector('[data-nickname-message]');
            try {
                var nickname = saveNickname(input && input.value);
                if (message) message.textContent = '已保存为“' + nickname + '”。此昵称仅保存在当前浏览器。';
                render(latestState);
            } catch (error) {
                if (message) message.textContent = error.message;
            }
        });

        document.querySelectorAll('[data-membership-retry]').forEach(function (button) {
            button.addEventListener('click', function () { vip.refresh(); });
        });
        document.querySelectorAll('[data-membership-logout]').forEach(function (button) {
            button.addEventListener('click', async function () {
                var message = document.querySelector('[data-membership-action-message]');
                if (!window.confirm('确定退出当前浏览器的会员权益吗？')) return;
                button.disabled = true;
                if (message) message.textContent = '正在退出…';
                try {
                    await vip.clear();
                    if (message) message.textContent = '已退出当前浏览器，其他工具数据未被清除。';
                } catch (error) {
                    if (message) message.textContent = '退出未完成：' + error.message + '。请重试。';
                    button.disabled = false;
                }
            });
        });

        var returnLink = document.querySelector('[data-membership-return]');
        if (returnLink) {
            var returnTo = vip.safeReturnTo(new URLSearchParams(location.search).get('returnTo'));
            returnLink.href = returnTo || '../index.html#workbench';
            returnLink.textContent = returnTo ? '返回刚才的工具' : '继续使用工具';
        }
    }

    vip.subscribe(render);
    initialiseDetails();
    vip.getSession(false);

    window.EhsSilMembershipUI = {
        getNickname: readNickname,
        normalizeNickname: normalizeNickname,
        render: render,
        saveNickname: saveNickname
    };
}());
