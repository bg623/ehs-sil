/**
 * EHS-SIL shared site shell.
 * Renders optional secondary-page Header/Footer placeholders and provides
 * keyboard/touch navigation without changing any tool business logic.
 */
(function () {
    'use strict';

    function normalisePrefix(value) {
        return value || '';
    }

    function renderHeader(host, index) {
        var prefix = normalisePrefix(host.getAttribute('data-prefix'));
        var mode = host.getAttribute('data-mode') || 'light';
        var mainTarget = host.getAttribute('data-main-target') || 'main-content';
        var id = 'siteShellNav' + index;
        host.innerHTML = '<header class="site-shell-header" data-mode="' + mode + '">' +
            '<a class="skip-link" href="#' + mainTarget + '">跳到主要内容</a>' +
            '<div class="container"><nav class="site-shell-nav" aria-label="网站主导航">' +
            '<a class="site-shell-brand" href="' + prefix + 'index.html" aria-label="EHS-SIL 首页">' +
            '<img class="brand-logo-image" src="' + prefix + 'assets/ehs-sil-logo.png" alt="" width="32" height="32">' +
            '<strong>EHS<span class="logo-sep">-</span>SIL</strong></a>' +
            '<button class="nav-toggle" type="button" aria-label="打开网站导航" aria-expanded="false" aria-controls="' + id + '"><span></span><span></span><span></span></button>' +
            '<ul class="site-shell-links nav-links" id="' + id + '">' +
            '<li class="nav-item has-dropdown"><div class="nav-parent-row"><a class="site-shell-link nav-link" href="' + prefix + 'index.html#workbench">专业工具</a><button class="nav-dropdown-toggle" type="button" aria-label="展开专业工具选项" aria-expanded="false">⌄</button></div>' +
            '<ul class="nav-dropdown"><li><a href="' + prefix + 'tools/jsa-tool.html">JSA 专业教练</a></li><li><a href="' + prefix + 'tools/risk-analysis.html">风险与事故分析</a></li><li><a href="' + prefix + 'tools/compliance-identification.html">企业适用法规识别</a></li></ul></li>' +
            '<li class="nav-item has-dropdown"><div class="nav-parent-row"><a class="site-shell-link nav-link" href="' + prefix + 'tools/">专业资源</a><button class="nav-dropdown-toggle" type="button" aria-label="展开专业资源选项" aria-expanded="false">⌄</button></div>' +
            '<ul class="nav-dropdown"><li><a href="' + prefix + 'tools/">工具与培训资料索引</a></li><li><a href="' + prefix + 'tools/regulations.html">EHS 法规导航</a></li><li><a href="' + prefix + 'products/toolbox.html">外企 EHS 工具箱</a></li></ul></li>' +
            '<li><a class="site-shell-link nav-link" href="' + prefix + 'index.html#membership">会员权益</a></li>' +
            '<li><a class="site-shell-link nav-link" href="' + prefix + 'dashboard/register.html">登录 / 激活</a></li>' +
            '</ul></nav></div></header>';
    }

    function renderFooter(host) {
        var prefix = normalisePrefix(host.getAttribute('data-prefix'));
        host.innerHTML = '<footer class="site-shell-footer"><div class="container">' +
            '<div class="site-shell-footer-row"><div><div class="site-shell-footer-brand">EHS-SIL</div><div>外企 EHS 工具与成长工作台</div></div>' +
            '<nav class="site-shell-footer-links" aria-label="页脚导航"><a href="' + prefix + 'index.html#workbench">专业工具</a><a href="' + prefix + 'tools/">专业资源</a><a href="' + prefix + 'tools/regulations.html">法规导航</a><a href="' + prefix + 'dashboard/register.html">会员激活</a></nav></div>' +
            '<p class="site-shell-footer-note">&copy; 2026 EHS-SIL · 工具结果仅供专业判断参考，须结合现场、企业程序和适用要求人工确认。</p>' +
            '</div></footer>';
    }

    function closeDropdowns(nav, except) {
        nav.querySelectorAll('.has-dropdown').forEach(function (item) {
            if (item === except) return;
            item.classList.remove('dropdown-open');
            var toggle = item.querySelector('.nav-dropdown-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });
    }

    function initialiseHeader(header) {
        if (header.getAttribute('data-shell-ready') === 'true') return;
        header.setAttribute('data-shell-ready', 'true');
        var nav = header.querySelector('.nav-links, .site-shell-links');
        var menuToggle = header.querySelector('.nav-toggle');
        if (!nav || !menuToggle) return;

        function closeMenu(restoreFocus) {
            nav.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', '打开网站导航');
            closeDropdowns(nav);
            if (restoreFocus) menuToggle.focus();
        }

        menuToggle.addEventListener('click', function () {
            var open = !nav.classList.contains('active');
            nav.classList.toggle('active', open);
            menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            menuToggle.setAttribute('aria-label', open ? '关闭网站导航' : '打开网站导航');
        });

        nav.querySelectorAll('.nav-dropdown-toggle').forEach(function (toggle) {
            toggle.setAttribute('aria-haspopup', 'true');
            toggle.addEventListener('click', function (event) {
                event.stopPropagation();
                var item = toggle.closest('.has-dropdown');
                var open = !item.classList.contains('dropdown-open');
                closeDropdowns(nav, item);
                item.classList.toggle('dropdown-open', open);
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
            toggle.addEventListener('keydown', function (event) {
                if (event.key !== 'ArrowDown') return;
                event.preventDefault();
                var item = toggle.closest('.has-dropdown');
                closeDropdowns(nav, item);
                item.classList.add('dropdown-open');
                toggle.setAttribute('aria-expanded', 'true');
                var firstLink = item.querySelector('.nav-dropdown a');
                if (firstLink) firstLink.focus();
            });
        });

        nav.addEventListener('click', function (event) {
            if (!event.target.closest('a')) return;
            closeMenu(false);
        });

        header.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') return;
            var openItem = nav.querySelector('.has-dropdown.dropdown-open');
            if (openItem) {
                var toggle = openItem.querySelector('.nav-dropdown-toggle');
                closeDropdowns(nav);
                if (toggle) toggle.focus();
                return;
            }
            closeMenu(true);
        });

        document.addEventListener('click', function (event) {
            if (!header.contains(event.target)) closeDropdowns(nav);
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 920) closeMenu(false);
        }, { passive: true });
    }

    document.querySelectorAll('[data-site-shell-header]').forEach(renderHeader);
    document.querySelectorAll('[data-site-shell-footer]').forEach(renderFooter);
    document.querySelectorAll('.site-header, .site-shell-header').forEach(initialiseHeader);
})();
