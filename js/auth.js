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
    return { ok: true, msg: '注册成功！请登录' };
}

function login(email, password) {
    var users = getUsers();
    var user = users[email];
    if (!user) return { ok: false, msg: '该邮箱未注册' };
    if (user.password !== btoa(password)) return { ok: false, msg: '密码错误' };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ email: email, name: user.name, vip: user.vip, loginTime: Date.now() }));
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
