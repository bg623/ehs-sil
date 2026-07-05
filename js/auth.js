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
    { code: 'EHS-SIL-2026', label: '知识星球用户', expires: '2030-12-31' }
,
    { code: 'EHS-VPJP592PTQ', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-R2Z74WH6JA', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-EZEK367CQN', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-PCKU3X9UWM', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-HK3EUVQ2QX', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-9ADL7EYE5J', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-EKPDHRLVS2', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-RQVXM75REX', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-YHS7GMTLW9', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-WU5MNGHMZS', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-S2QYEZJKYN', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-RXQCPDWWZ3', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-GHX6YYX363', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-KGWEKN9HFL', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-AS52HKJUKJ', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-G945MM6CLP', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-SMM26GGJXZ', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-27ZLUG9NPL', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-52VKNNT92T', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-XXUZAZDZ9P', label: 'VIP年卡(1年)', expires: '2027-07-05' },
    { code: 'EHS-DTTNPWM4DR', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-K29ZLFCG25', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-V3CZXFH4KV', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-ZPZEY5M37C', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-N6WSVM356A', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-YE4Q62TUE5', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-HPJRXGLKTC', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-ZW926NWFNU', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-6KEQ4TPT24', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-D2GYZ3ZDGC', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-KJ9X2TSJ5D', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-N5WWRY3C9V', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-VFTTT9C2PH', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-4SEL5YMGHL', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-JYFNRPHD4A', label: 'VIP年卡(2年)', expires: '2028-07-04' },
    { code: 'EHS-EKV29CQAMQ', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-UGKKK6696Z', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-QUL6VQR49X', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-YV4ZQR35SP', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-2WPUPLAMR7', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-S95235TDH3', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-E4F5GVKY7L', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-N4Q6JN2MEP', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-TQPKRA7VWH', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-U6SZJWDYC3', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-HAC6FPTJQ2', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-D2WQ4FFGWR', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-SUM6W43L2A', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-YYAFN5AR3R', label: 'VIP年卡(3年)', expires: '2029-07-04' },
    { code: 'EHS-TY46N6KEZL', label: 'VIP年卡(3年)', expires: '2029-07-04' }
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
