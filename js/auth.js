(function() {
    var PASSWORD = 'ehs-sil-2026';
    function checkAuth() {
        if (localStorage.getItem('ehs_sil_auth') === 'true') return;
        var attempt = prompt('请输入访问密码');
        if (attempt === PASSWORD) {
            localStorage.setItem('ehs_sil_auth', 'true');
            return;
        }
        if (attempt === null) {
            document.body.innerHTML = '<div style="text-align:center;padding:4rem;color:#636e72;font-family:sans-serif"><h2>需要密码才能访问</h2><p style="margin-top:.5rem;font-size:.9rem">请联系 John Yu</p></div>';
            return;
        }
        alert('密码错误，请重试');
        checkAuth();
    }
    checkAuth();
})();
