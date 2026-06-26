/**
 * EHS-SIL Auth System
 * Simple localStorage-based auth for static site
 * - Registration: email + password → stored in localStorage
 * - VIP activation: enter shared code → marks user as VIP
 * - All paid tools check isVip() before showing content
 */

// === Config ===
// John can change this code and share with Knowledge Planet customers
var VIP_CODE = 'EHS-SIL-2026';

// === Storage Keys ===
var STORAGE_KEYS = {
    USERS: 'ehs_sil_users',
    SESSION: 'ehs_sil_session',
    VIP: 'ehs_sil_vip'
};

// === Event Tracking (Baidu Analytics) ===
function trackEvent(category, action, label) {
    try {
        if (typeof _hmt !== "undefined" && _hmt.push) {
            _hmt.push(["_trackEvent", category, action, label, 1]);
        }
    } catch(e) {}
}

// === User Management ===
function getUsers() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || {}; }
    catch(e) { return {}; }
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function register(email, password, name) {
    var users = getUsers();
    if (users[email]) return { ok: false, msg: '该邮箱已注册，请直接登录' };
    if (password.length < 4) return { ok: false, msg: '密码至少4位字符' };
    users[email] = { email: email, password: btoa(password), name: name || email.split('@')[0], registered: new Date().toISOString(), vip: false };
    saveUsers(users);
    trackEvent('auth', 'register', email);
    return { ok: true, msg: '注册成功！请登录' };
}

function login(email, password) {
    var users = getUsers();
    var user = users[email];
    if (!user) return { ok: false, msg: '该邮箱未注册' };
    if (user.password !== btoa(password)) return { ok: false, msg: '密码错误' };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ email: email, name: user.name, vip: user.vip, loginTime: Date.now() }));
    trackEvent('auth', 'login', email);
    return { ok: true, msg: '登录成功' };
}

function logout() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    window.location.href = '../index.html';
}

function getSession() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION)); }
    catch(e) { return null; }
}

function isLoggedIn() {
    return getSession() !== null;
}

function isVip() {
    var s = getSession();
    return s && s.vip === true;
}

function checkVipFromUsers(email) {
    var users = getUsers();
    return users[email] && users[email].vip === true;
}

// === VIP Activation ===
function activateVip(code, email) {
    if (code !== VIP_CODE) return { ok: false, msg: '激活码无效，请确认后重试。\n提示：购买知识星球产品后获取激活码' };
    if (!email) {
        var s = getSession();
        if (s) email = s.email;
    }
    if (!email) return { ok: false, msg: '请先登录后再激活VIP' };
    var users = getUsers();
    if (!users[email]) return { ok: false, msg: '用户不存在，请先注册' };
    users[email].vip = true;
    saveUsers(users);
    trackEvent('vip', 'activate', email);
    // Update session
    var session = getSession();
    if (session) { session.vip = true; localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session)); }
    localStorage.setItem(STORAGE_KEYS.VIP, 'true');
    return { ok: true, msg: 'VIP激活成功！现在可以访问所有高级工具' };
}

function checkVipStatus() {
    // Check if current session has VIP
    if (isVip()) return true;
    // Check from user data
    var s = getSession();
    if (s && checkVipFromUsers(s.email)) {
        s.vip = true;
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(s));
        return true;
    }
    // Check legacy flag
    if (localStorage.getItem(STORAGE_KEYS.VIP) === 'true') return true;
    return false;
}

// === Gated Content Check ===
function requireAuth(redirectUrl) {
    if (!isLoggedIn()) {
        showGateModal('login');
        return false;
    }
    if (!checkVipStatus()) {
        showGateModal('vip');
        return false;
    }
    return true;
}

function showGateModal(type) {
    var overlay = document.getElementById('gateOverlay');
    if (overlay) { overlay.style.display = 'flex'; return; }
    overlay = document.createElement('div');
    overlay.id = 'gateOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:12px;padding:2.5rem;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;position:relative';
    var html = '<button onclick="this.closest(\'#gateOverlay\').remove()" style="position:absolute;top:.5rem;right:.8rem;border:none;background:none;font-size:1.5rem;cursor:pointer;color:#999">&times;</button>';
    if (type === 'login') {
        html += '<div style="font-size:2.5rem;margin-bottom:.5rem">&#128274;</div><h3 style="margin:0 0 .3rem;color:#0d2836">请先登录</h3><p style="font-size:.85rem;color:#666;margin-bottom:1.2rem">登录后即可使用此工具</p>' +
            '<a href="../dashboard/account.html" style="display:block;padding:.7rem;background:#0d2836;color:#fff;border-radius:6px;text-decoration:none;font-size:.9rem;font-weight:500;margin-bottom:.5rem">登录 / 注册</a>' +
            '<a href="javascript:void(0)" onclick="this.closest(\'#gateOverlay\').remove()" style="font-size:.8rem;color:#999">稍后再说</a>';
    } else {
        html += '<div style="font-size:2.5rem;margin-bottom:.5rem">&#11088;</div><h3 style="margin:0 0 .3rem;color:#0d2836">需要VIP权限</h3><p style="font-size:.85rem;color:#666;margin-bottom:1.2rem">购买知识星球产品的粉丝可免费获取激活码</p>' +
            '<a href="../dashboard/account.html" style="display:block;padding:.7rem;background:#b8860b;color:#fff;border-radius:6px;text-decoration:none;font-size:.9rem;font-weight:500;margin-bottom:.5rem">激活VIP</a>' +
            '<a href="javascript:void(0)" onclick="this.closest(\'#gateOverlay\').remove()" style="font-size:.8rem;color:#999">稍后再说</a>';
    }
    card.innerHTML = html;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
}
/**
 * EHS-SIL VIP Activation
 * Simplified: just enter activation code, no registration/login
 * John can change VIP_CODE and share with Knowledge Planet customers
 */
var VIP_CODE = 'EHS-SIL-2026';

function isVip() {
    return localStorage.getItem('ehs_sil_vip') === 'true';
}

function activateVip(code) {
    if (code !== VIP_CODE) {
        return { ok: false, msg: '激活码无效，请确认后重试\n提示：购买知识星球产品后获取激活码' };
    }
    localStorage.setItem('ehs_sil_vip', 'true');
    return { ok: true, msg: 'VIP激活成功！现在可以访问所有高级工具' };
}

function checkVipStatus() {
    return isVip();
}

function clearVip() {
    localStorage.removeItem('ehs_sil_vip');
    location.reload();
}

function renderSimpleGate(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (isVip()) {
        el.innerHTML = '<div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:1rem;margin-top:.8rem">' +
            '<h3 style="font-size:.85rem;color:#16a34a;margin-bottom:.3rem">&#10003; VIP已激活</h3>' +
            '<p style="font-size:.78rem;color:#333">VIP工具已解锁，您可以使用下方所有资源。</p>' +
            '<div id="vipContent" style="margin-top:.6rem"></div></div>';
        return true;
    } else {
        el.innerHTML = '<div style="background:#fefce8;border:2px dashed #fde68a;border-radius:12px;padding:1.5rem 2rem;text-align:center">' +
            '<div style="font-size:2.5rem;margin-bottom:.3rem">&#11088;</div>' +
            '<h3 style="font-size:1rem;color:#0d2836;margin-bottom:.3rem">VIP专享内容</h3>' +
            '<p style="font-size:.82rem;color:#666;margin-bottom:1rem">已购买「外企EHS工具箱」或「外企培训库」？<br>输入激活码解锁全部高级工具</p>' +
            '<div style="display:flex;gap:.3rem;max-width:350px;margin:0 auto">' +
            '<input id="gateCode" type="text" style="flex:1;padding:.5rem .6rem;border:1.5px solid #ddd;border-radius:6px;font-size:.82rem;outline:none" placeholder="输入激活码" onkeydown="if(event.key===\'Enter\')doGateActivate()">' +
            '<button onclick="doGateActivate()" style="padding:.5rem .8rem;background:#b8860b;color:#fff;border:none;border-radius:6px;font-size:.82rem;font-weight:500;cursor:pointer;white-space:nowrap">激活</button></div>' +
            '<div id="gateMsg" style="font-size:.78rem;margin-top:.4rem;display:none"></div>' +
            '<div style="font-size:.72rem;color:#999;margin-top:.6rem">不知道激活码？<a href="https://wx.zsxq.com/group/88882255181182" target="_blank" style="color:#b8860b">购买知识星球产品</a></div></div>';
        return false;
    }
}

function doGateActivate() {
    var input = document.getElementById('gateCode');
    var msg = document.getElementById('gateMsg');
    if (!input || !msg) return;
    var code = input.value.trim();
    if (!code) {
        msg.textContent = '请输入激活码';
        msg.style.display = 'block'; msg.style.color = '#dc2626'; return;
    }
    var result = activateVip(code);
    if (result.ok) {
        msg.textContent = result.msg + '！页面即将刷新...';
        msg.style.display = 'block'; msg.style.color = '#16a34a';
        setTimeout(function(){ location.reload(); }, 1200);
    } else {
        msg.textContent = result.msg;
        msg.style.display = 'block'; msg.style.color = '#dc2626';
    }
}
