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

    function navEntry(href, title, description, attributes) {
        return '<li><a href="' + href + '"' + (attributes || '') + '>' +
            '<span class="nav-entry-title">' + title + '</span>' +
            '<span class="nav-entry-desc">' + description + '</span>' +
            '</a></li>';
    }

    function renderHeader(host, index) {
        var prefix = normalisePrefix(host.getAttribute('data-prefix'));
        var mode = host.getAttribute('data-mode') || 'light';
        var mainTarget = host.getAttribute('data-main-target') || 'main-content';
        var id = 'siteShellNav' + index;
        var toolsId = id + 'Tools';
        var resourcesId = id + 'Resources';
        var aboutId = id + 'About';
        host.innerHTML = '<header class="site-shell-header" data-mode="' + mode + '">' +
            '<a class="skip-link" href="#' + mainTarget + '">跳到主要内容</a>' +
            '<div class="container"><nav class="site-shell-nav" aria-label="网站主导航">' +
            '<a class="site-shell-brand" href="' + prefix + 'index.html" aria-label="EHS-SIL 首页">' +
            '<img class="brand-logo-image" src="' + prefix + 'assets/ehs-sil-logo.png" alt="" width="32" height="32">' +
            '<strong>EHS<span class="logo-sep">-</span>SIL</strong></a>' +
            '<button class="nav-toggle" type="button" aria-label="打开网站导航" aria-expanded="false" aria-controls="' + id + '"><span></span><span></span><span></span></button>' +
            '<ul class="site-shell-links nav-links" id="' + id + '">' +
            '<li class="nav-item" data-nav-section="home"><a class="site-shell-link nav-link" data-nav-section-link="home" href="' + prefix + 'index.html">首页</a></li>' +
            '<li class="nav-item has-dropdown" data-nav-section="tools"><div class="nav-parent-row"><a class="site-shell-link nav-link" data-nav-section-link="tools" href="' + prefix + 'index.html#workbench">专业工具</a><button class="nav-dropdown-toggle" type="button" aria-label="展开专业工具选项" aria-expanded="false" aria-controls="' + toolsId + '"><span class="nav-chevron" aria-hidden="true"></span></button></div>' +
            '<ul class="nav-dropdown nav-dropdown-wide" id="' + toolsId + '">' +
            navEntry(prefix + 'index.html#workbench', '专业工具总览', '按风险、事故与管理任务选择方法', ' class="nav-entry-featured"') +
            navEntry(prefix + 'tools/jsa-tool.html', 'JSA 工作安全分析专业教练', '生成可编辑初稿并检查风险与控制措施') +
            navEntry(prefix + 'tools/chemical-reactivity-matrix.html', '化学品反应与禁忌矩阵', '禁忌物、误混与库存相容性筛查') +
            navEntry(prefix + 'tools/risk-analysis.html#risk-assessment', '风险辨识与评估', 'FMEA 失效模式分析、What-If 假设分析') +
            navEntry(prefix + 'tools/risk-analysis.html#incident-investigation', '事故调查与根因分析', '5Why 五问法、RCA 根本原因分析、Tripod Beta 三脚架分析') +
            navEntry(prefix + 'tools/incident-learning.html', 'LFI 事故学习闭环', '事件报告、调查、整改与组织学习') +
            navEntry(prefix + 'tools/training-matrix.html', '岗位 EHS 培训矩阵', '生成可编辑的培训需求底稿') +
            navEntry(prefix + 'tools/compliance-identification.html', '企业适用法规识别', '按行业与地区生成候选清单') +
            navEntry(prefix + 'index.html#practice-tools', '外企管理实践', 'BBS 行为安全观察、LOTO 上锁挂牌等') +
            '</ul></li>' +
            '<li class="nav-item has-dropdown" data-nav-section="resources"><div class="nav-parent-row"><a class="site-shell-link nav-link" data-nav-section-link="resources" href="' + prefix + 'tools/index.html">专业资源</a><button class="nav-dropdown-toggle" type="button" aria-label="展开专业资源选项" aria-expanded="false" aria-controls="' + resourcesId + '"><span class="nav-chevron" aria-hidden="true"></span></button></div>' +
            '<ul class="nav-dropdown nav-dropdown-wide" id="' + resourcesId + '">' +
            navEntry(prefix + 'tools/index.html', '工具与培训资料索引', '预览知识星球已发布与规划内容', ' class="nav-entry-featured"') +
            navEntry(prefix + 'tools/ehs-glossary.html', '外企EHS专业术语库', '445词、196缩写与24组易混辨析') +
            navEntry(prefix + 'tools/regulations.html', '法规与标准导航', '查找中国与国际官方来源') +
            navEntry(prefix + 'articles/', '专业文章', '方法、案例与 EHS 实操指南') +
            navEntry(prefix + 'products/toolbox.html', '外企 EHS 工具箱', '模板、案例与持续更新资源') +
            navEntry(prefix + 'products/training.html', '外企 EHS 培训库', '课程与职业能力成长资源') +
            '</ul></li>' +
            '<li class="nav-item has-dropdown" data-nav-section="about"><div class="nav-parent-row"><a class="site-shell-link nav-link" data-nav-section-link="about" href="' + prefix + 'index.html#value">了解 EHS-SIL</a><button class="nav-dropdown-toggle" type="button" aria-label="展开网站介绍选项" aria-expanded="false" aria-controls="' + aboutId + '"><span class="nav-chevron" aria-hidden="true"></span></button></div>' +
            '<ul class="nav-dropdown nav-dropdown-compact" id="' + aboutId + '">' +
            navEntry(prefix + 'index.html#value', '网站能帮你做什么', '从问题到方法、工具与成果') +
            navEntry(prefix + 'index.html#about', '主理人与 EHS-SIL', '了解网站定位与专业背景') +
            navEntry(prefix + 'index.html#faq', '常见问题', '使用范围、资源与专业边界') +
            '</ul></li>' +
            '<li class="nav-item nav-membership" data-nav-section="membership"><a class="site-shell-link nav-link" data-nav-section-link="membership" href="' + prefix + 'index.html#membership">会员权益</a></li>' +
            '<li class="nav-item nav-account" data-nav-section="account"><a class="site-shell-link nav-link nav-account-link" data-nav-section-link="account" href="' + prefix + 'dashboard/register.html">登录 / 激活</a></li>' +
            '</ul></nav></div></header>';
    }

    function renderFooter(host) {
        var prefix = normalisePrefix(host.getAttribute('data-prefix'));
        host.innerHTML = '<footer class="site-shell-footer"><div class="container">' +
            '<div class="site-shell-footer-row"><div><div class="site-shell-footer-brand">EHS-SIL</div><div>外企 EHS 工具与成长工作台</div></div>' +
            '<nav class="site-shell-footer-links" aria-label="页脚导航"><a href="' + prefix + 'index.html#workbench">专业工具</a><a href="' + prefix + 'tools/index.html">专业资源</a><a href="' + prefix + 'tools/regulations.html">法规导航</a><a href="' + prefix + 'dashboard/register.html">会员激活</a></nav></div>' +
            '<p class="site-shell-footer-note">&copy; 2026 EHS-SIL · 工具结果仅供专业判断参考，须结合现场、企业程序和适用要求人工确认。</p>' +
            '<p class="site-shell-footer-note"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">鲁ICP备2026013311号-2</a></p>' +
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
            document.body.classList.remove('nav-open');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', '打开网站导航');
            closeDropdowns(nav);
            if (restoreFocus) menuToggle.focus();
        }

        menuToggle.addEventListener('click', function () {
            var open = !nav.classList.contains('active');
            nav.classList.toggle('active', open);
            document.body.classList.toggle('nav-open', open);
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

        nav.querySelectorAll('.nav-dropdown').forEach(function (dropdown) {
            var links = Array.from(dropdown.querySelectorAll('a'));
            links.forEach(function (link, linkIndex) {
                link.addEventListener('keydown', function (event) {
                    var nextIndex;
                    if (event.key === 'ArrowDown') nextIndex = (linkIndex + 1) % links.length;
                    else if (event.key === 'ArrowUp') nextIndex = (linkIndex - 1 + links.length) % links.length;
                    else if (event.key === 'Home') nextIndex = 0;
                    else if (event.key === 'End') nextIndex = links.length - 1;
                    else return;
                    event.preventDefault();
                    links[nextIndex].focus();
                });
            });
        });

        function updateCurrentSection() {
            var pathname = window.location.pathname.replace(/\/index\.html$/, '/');
            var hash = window.location.hash;
            var section = 'home';
            if (/\/dashboard\//.test(pathname)) section = 'account';
            else if (/\/(?:articles|topics)\//.test(pathname) || /\/products\//.test(pathname) || /\/tools\/(?:regulations\.html)?$/.test(pathname)) section = 'resources';
            else if (/\/tools\//.test(pathname)) section = 'tools';
            else if (hash === '#membership') section = 'membership';
            else if (['#value', '#about', '#faq'].indexOf(hash) !== -1) section = 'about';
            else if (['#workbench', '#risk-tools', '#incident-tools', '#practice-tools'].indexOf(hash) !== -1) section = 'tools';

            nav.querySelectorAll('[data-nav-section]').forEach(function (item) {
                var active = item.getAttribute('data-nav-section') === section;
                item.classList.toggle('nav-current', active);
                var link = item.querySelector('[data-nav-section-link]');
                if (!link) return;
                if (active) link.setAttribute('aria-current', section === 'home' ? 'page' : 'location');
                else link.removeAttribute('aria-current');
            });
        }

        updateCurrentSection();
        window.addEventListener('hashchange', updateCurrentSection);

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
