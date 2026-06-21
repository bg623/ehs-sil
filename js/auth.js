(function() {
    var PASSWORD = 'ehs-sil-2026';
    
    function checkAuth() {
        var authed = sessionStorage.getItem('ehs_sil_auth');
        if (authed === 'true') return;
        
        var attempt = prompt('请输入访问密码（联系 John Yu 获取）');
        if (attempt === PASSWORD) {
            sessionStorage.setItem('ehs_sil_auth', 'true');
            return;
        }
        if (attempt === null) {
            window.location.href = '../index.html';
            return;
        }
        alert('密码错误');
        window.location.href = '../index.html';
    }
    
    checkAuth();
})();
