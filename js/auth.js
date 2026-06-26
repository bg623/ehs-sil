/**
 * EHS-SIL VIP Activation System
 * Simplified: one-time activation code, no registration/login
 */
var VIP_CODE = 'EHS-SIL-2026';

function isVip() {
    try { return localStorage.getItem('ehs_sil_vip') === 'true'; }
    catch(e) { return false; }
}

function activateVip(code) {
    if (code !== VIP_CODE) {
        return { ok: false, msg: '激活码无效，请确认后重试\n提示：购买知识星球产品后获取激活码' };
    }
    localStorage.setItem('ehs_sil_vip', 'true');
    return { ok: true, msg: 'VIP激活成功！现在可以访问所有高级工具' };
}

function checkVipStatus() { return isVip(); }

function clearVip() {
    localStorage.removeItem('ehs_sil_vip');
    location.reload();
}

function renderSimpleGate(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return false;
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
    try {
        var result = activateVip(code);
        if (result.ok) {
            msg.textContent = result.msg + '！页面即将刷新...';
            msg.style.display = 'block'; msg.style.color = '#16a34a';
            setTimeout(function(){ location.reload(); }, 1200);
        } else {
            msg.textContent = result.msg;
            msg.style.display = 'block'; msg.style.color = '#dc2626';
        }
    } catch(e) {
        msg.textContent = '激活出错，请重试';
        msg.style.display = 'block'; msg.style.color = '#dc2626';
    }
}
