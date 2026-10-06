// OSS may serve the root index for directory requests. Preserve old entry URLs.
// This is a client fallback; a production 301 still requires hosting approval.
(function () {
  'use strict';
  var aliases = {
    '/tools': '/tools/index.html',
    '/tools/': '/tools/index.html',
    '/articles': '/articles/index.html',
    '/articles/': '/articles/index.html'
  };
  var target = aliases[window.location.pathname];
  if (target) window.location.replace(target + window.location.search + window.location.hash);
}());
