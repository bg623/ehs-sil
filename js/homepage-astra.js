(function () {
    'use strict';

    function setupTaskRouter() {
        var router = document.querySelector('[data-task-router]');
        if (!router) return;

        var tabs = Array.from(router.querySelectorAll('[data-task-tab]'));
        var panels = Array.from(router.querySelectorAll('[data-task-panel]'));

        function activate(tab, moveFocus) {
            var target = tab.getAttribute('data-task-tab');

            tabs.forEach(function (item) {
                var selected = item === tab;
                item.setAttribute('aria-selected', String(selected));
                item.setAttribute('tabindex', selected ? '0' : '-1');
            });

            panels.forEach(function (panel) {
                var selected = panel.getAttribute('data-task-panel') === target;
                panel.hidden = !selected;
                panel.classList.toggle('is-active', selected);
            });

            if (moveFocus) tab.focus();
        }

        tabs.forEach(function (tab, index) {
            tab.addEventListener('click', function () { activate(tab, false); });
            tab.addEventListener('keydown', function (event) {
                var nextIndex = null;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                if (nextIndex === null) return;
                event.preventDefault();
                activate(tabs[nextIndex], true);
            });
        });
    }

    function setupBackToTop() {
        var button = document.getElementById('backToTop');
        if (!button) return;
        button.addEventListener('click', function () {
            var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        });
    }

    function setupMembershipTracking() {
        var link = document.querySelector('[data-astra-action="click-member"]');
        if (!link) return;
        link.addEventListener('click', function () {
            if (!window.EhsSilAnalytics) return;
            window.EhsSilAnalytics.track('click_member', {
                toolId: 'toolbox-membership',
                sourceChannel: 'site',
                pageType: 'other'
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setupTaskRouter();
            setupBackToTop();
            setupMembershipTracking();
        });
    } else {
        setupTaskRouter();
        setupBackToTop();
        setupMembershipTracking();
    }
})();
