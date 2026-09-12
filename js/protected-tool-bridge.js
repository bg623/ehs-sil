/**
 * Bridge public OSS placeholders to the server-authorized VIP tool service.
 * Browser state never grants access; the Worker validates the HttpOnly session.
 */
(function () {
    'use strict';

    var root = document.querySelector('[data-protected-tool-bridge]');
    if (!root) return;

    var title = root.querySelector('[data-bridge-title]');
    var message = root.querySelector('[data-bridge-message]');
    var action = root.querySelector('[data-bridge-action]');
    var toolPath = root.getAttribute('data-protected-tool-path') || '';
    var protectedPaths = [
        '/tools/apollo-rca-tool.html',
        '/tools/content-repurposer.html',
        '/tools/fmea-tool.html',
        '/tools/tripod-beta-tool.html',
        '/tools/what-if-guide.html',
        '/tools/what-if-tool.html'
    ];

    function setState(status, heading, detail, label, href) {
        root.setAttribute('data-bridge-status', status);
        if (title) title.textContent = heading;
        if (message) message.textContent = detail;
        if (action) {
            action.textContent = label;
            action.href = href;
        }
    }

    if (protectedPaths.indexOf(toolPath) < 0) {
        setState('error', '工具地址无效', '请返回专业工具页重新选择。', '返回专业工具', '/tools/index.html');
        return;
    }

    var secureUrl = 'https://vip-api.ehs-sil.com' + toolPath;
    var registerUrl = '/dashboard/register.html?returnTo=' + encodeURIComponent(toolPath);
    if (action) action.href = secureUrl;

    var vip = window.EhsSilVip;
    if (!vip || typeof vip.getSession !== 'function') {
        setState('fallback', '进入安全会员工具', '将由安全服务器再次确认当前浏览器的会员会话。', '进入会员工具', secureUrl);
        return;
    }

    vip.getSession(true).then(function (session) {
        if (session && session.active) {
            setState('active', '会员身份已确认', '正在进入安全工具…', '立即进入', secureUrl);
            window.location.replace(secureUrl);
            return;
        }

        if (session && session.status === 'error') {
            setState('error', '暂时无法确认会员身份', session.message || '请重新验证权益后再进入工具。', '重新验证会员身份', registerUrl);
            return;
        }

        var detail = session && session.status === 'expired'
            ? '当前权益已到期，续期并重新激活后即可使用。'
            : session && session.status === 'revoked'
                ? '当前权益已失效，请通过会员问题反馈联系管理员。'
                : '当前浏览器尚未确认有效会员权益。';
        setState('inactive', '需要验证会员身份', detail, '验证会员身份', registerUrl);
    }).catch(function () {
        setState('error', '暂时无法确认会员身份', '请重新验证权益，或稍后再试。', '重新验证会员身份', registerUrl);
    });
}());
