/**
 * EHS-SIL VIP Activation System v2
 * Multi-code + expiry support
 * 2026-07
 */

/** ==========================================
 *  VIP CODE DATABASE
 *  John：在这里添加新的激活码
 *  格式：{ code: 'EHS-XXXXXX', label: '购买VIP年卡', expires: '2027-12-31' }
 *  ========================================== */
var VIP_CODES = [
    { code: 'EHS-SIL-2026', label: '知识星球用户', expires: '2030-12-31' },
    { code: 'EHS-7PAD2RVJA4', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-QHG7JF4V3S', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-LDHQ64YYER', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-KM2PETZJ49', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-VYKLCJQWVY', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-6WHU6D4ZDF', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-LXXQN5X25S', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-5NZMPDV7D7', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-K9PCJALEKV', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-F4T7SMWEMT', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-KWMULQ9ZRU', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-MANRXUEWZ2', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-XPNCRJQLCH', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-FH24K2UUQ3', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-Z9EGNU64PC', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-4EWNRLDFH6', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-Y9U52TMGL4', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-6ZQQW5GALL', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-6XQDFG9UAH', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-YCG234MCW9', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-KJ9F23EVZD', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-9FRH5475D6', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-7KKGSVKFPM', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-49VGFHLW7K', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-9G722LGHSW', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-L2K37KXEJF', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-KJ3YS7GE4J', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-YQ5FZSJUCT', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-H3JALNGRGS', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-D3AMVX3SA7', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-FEHHUEPTZ3', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-3HMDRCU9LZ', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-4UCDMUK3ZX', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-F5FDWARMN6', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-RVKSDJVWRP', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-4FLLAVTHJZ', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-4R9GG2FUTZ', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-M2L3TEEJMJ', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-JR969P2Z66', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-VSKVYV9KA4', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-CD2YCWMLXR', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-RKJ29E4Q6Z', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-QGKKPN7QCR', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-2KT7FXHH75', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-ALHWPVX2AV', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-4PA4FM2ZZG', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-4277GM6AE6', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-KURZRJYE5D', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-MPN4ALJ5Q2', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-9GMP4FXWD5', label: 'VIP年卡(3年)', expires: '2029-07-04' }
];


/** ==========================================
 *  CORE FUNCTIONS
 *  ========================================== */

/** Check if currently activated VIP is still valid */
function isVip() {
    try {
        var raw = localStorage.getItem('ehs_sil_vip_data');
        if (!raw) return false;
        var d = JSON.parse(raw);
        if (!d || !d.expires) return false;
        var now = new Date();
        var exp = new Date(d.expires);
        return exp > now;
    } catch(e) { return false; }
}

/** Get stored VIP info (code, label, expires, activated) */
function getVipInfo() {
    try {
        var raw = localStorage.getItem('ehs_sil_vip_data');
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

/** Activate with a code from VIP_CODES */
function activateVip(code) {
    var trimmed = (code || '').trim();
    if (!trimmed) return { ok: false, msg: '请输入激活码' };

    for (var i = 0; i < VIP_CODES.length; i++) {
        if (VIP_CODES[i].code === trimmed) {
            var matched = VIP_CODES[i];
            var now = new Date();
            var exp = new Date(matched.expires);
            if (exp <= now) {
                return { ok: false, msg: '此激活码已过期（有效期至 ' + matched.expires + '）' };
            }
            var today = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0');
            localStorage.setItem('ehs_sil_vip_data', JSON.stringify({
                code: matched.code,
                label: matched.label,
                expires: matched.expires,
                activated: today
            }));
            return { ok: true, msg: 'VIP激活成功！有效期至 ' + matched.expires };
        }
    }
    return { ok: false, msg: '激活码无效，请确认后重试' };
}

function checkVipStatus() { return isVip(); }

function clearVip() {
    localStorage.removeItem('ehs_sil_vip_data');
    localStorage.removeItem('ehs_sil_vip');
    location.reload();
}


/** ==========================================
 *  UI GATE — used on tool pages
 *  ========================================== */
function renderSimpleGate(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return false;

    if (isVip()) {
        var info = getVipInfo();
        var expiryStr = (info && info.expires) ? '有效期至 ' + info.expires : '';
        var labelStr = (info && info.label) ? ' · ' + info.label : '';
        el.innerHTML = '<div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:1rem;margin-top:.8rem">' +
            '<h3 style="font-size:.85rem;color:#16a34a;margin-bottom:.3rem">&#10003; VIP已激活</h3>' +
            '<p style="font-size:.78rem;color:#333">VIP工具已解锁' + expiryStr + labelStr + '</p>' +
            '<div id="vipContent" style="margin-top:.6rem"></div></div>';
        return true;
    } else {
        el.innerHTML = '<div style="background:#fefce8;border:2px dashed #fde68a;border-radius:12px;padding:1.5rem 2rem;text-align:center;max-width:440px;margin:0 auto">' +
            '<div style="font-size:2.5rem;margin-bottom:.3rem">&#11088;</div>' +
            '<h3 style="font-size:1rem;color:#0d2836;margin-bottom:.3rem">VIP专享内容</h3>' +
            '<p style="font-size:.82rem;color:#666;margin-bottom:1rem">已购买知识星球产品？或已购买VIP年卡？<br>输入激活码解锁全部高级工具</p>' +
            '<div style="display:flex;gap:.3rem;max-width:320px;margin:0 auto">' +
            '<input id="gateCode" type="text" style="flex:1;padding:.5rem .6rem;border:1.5px solid #ddd;border-radius:6px;font-size:.82rem;outline:none" placeholder="输入激活码" onkeydown="if(event.key===\'Enter\')doGateActivate()">' +
            '<button onclick="doGateActivate()" style="padding:.5rem .8rem;background:#b8860b;color:#fff;border:none;border-radius:6px;font-size:.82rem;font-weight:500;cursor:pointer;white-space:nowrap">激活</button></div>' +
            '<div id="gateMsg" style="font-size:.78rem;margin-top:.4rem;display:none"></div>' +
            '<div style="font-size:.72rem;color:#999;margin-top:.6rem">还没有激活码？<a href="../dashboard/register.html" style="color:#b8860b">29.9元/年 购买VIP →</a></div></div>';
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
        msg.style.display = 'block'; msg.style.color = '#dc2626';
        return;
    }
    try {
        var result = activateVip(code);
        if (result.ok) {
            msg.textContent = result.msg + '，页面即将刷新...';
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
