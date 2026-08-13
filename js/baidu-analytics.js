/** Shared privacy-limited Baidu Analytics loader for public pages. */
(function () {
    'use strict';
    window._hmt = window._hmt || [];
    if (document.querySelector('script[data-ehs-baidu-analytics]')) return;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://hm.baidu.com/hm.js?77c75d1a7737386055212c64df8ff967';
    script.setAttribute('data-ehs-baidu-analytics', 'true');
    document.head.appendChild(script);
})();
