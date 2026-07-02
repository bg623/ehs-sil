/**
 * EHS-SIL · Main Site Scripts
 * Smooth scroll, stat counter, mobile nav, scroll animations
 */
(function() {
    'use strict';

    // ===== Mobile Nav Toggle =====
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
        // Close nav on link click (mobile)
        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function() {
                navLinks.classList.remove('active');
            });
        });
    }

    // ===== Sticky nav background on scroll =====
    const header = document.getElementById('siteHeader');
    let lastScroll = 0;
    window.addEventListener('scroll', function() {
        const scrollY = window.scrollY;
        if (scrollY > 60) {
            header.style.borderBottomColor = 'var(--border)';
            header.style.background = 'rgba(249, 248, 246, 0.97)';
        } else {
            header.style.borderBottomColor = 'var(--border-light)';
            header.style.background = 'rgba(249, 248, 246, 0.92)';
        }
        lastScroll = scrollY;
    }, { passive: true });

    // ===== Animated Stat Counters =====
    function animateCounters() {
        const counters = document.querySelectorAll('.stat-num');
        if (!counters.length) return;

        let hasAnimated = false;

        function isInViewport(el) {
            const rect = el.getBoundingClientRect();
            return rect.top < window.innerHeight - 80 && rect.bottom > 0;
        }

        function startCounters() {
            if (hasAnimated) return;
            const triggerEl = counters[0];
            if (!isInViewport(triggerEl)) return;
            hasAnimated = true;

            counters.forEach(counter => {
                const target = parseInt(counter.getAttribute('data-target'), 10);
                if (isNaN(target) || target <= 0) return;

                // For larger numbers, count faster
                const duration = target > 5000 ? 2000 : 1500;
                const increment = target > 5000 ? Math.ceil(target / 60) : Math.ceil(target / 50);
                let current = 0;

                function updateCounter() {
                    current += increment;
                    if (current >= target) {
                        counter.textContent = target.toLocaleString();
                        return;
                    }
                    counter.textContent = current.toLocaleString();
                    requestAnimationFrame(function() {
                        setTimeout(updateCounter, 25);
                    });
                }
                updateCounter();
            });
        }

        // Check on scroll
        window.addEventListener('scroll', function() {
            if (!hasAnimated) startCounters();
        }, { passive: true });

        // Also check on load
        startCounters();
    }

    // ===== Smooth fade-in scroll animations =====
    function initScrollAnimations() {
        const sections = document.querySelectorAll('section');
        sections.forEach(section => {
            section.classList.add('fade-in');
        });

        function checkVisibility() {
            const elements = document.querySelectorAll('.fade-in:not(.visible)');
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight - 60) {
                    el.classList.add('visible');
                }
            });
        }

        window.addEventListener('scroll', checkVisibility, { passive: true });
        checkVisibility(); // initial check
    }

    // ===== Smooth scroll for anchor links =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        });
    });

    // ===== Initialize =====
    document.addEventListener('DOMContentLoaded', function() {
        animateCounters();
        initScrollAnimations();
    });
})();

// Back-to-top button
(function() {
    var btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', function() {
        if (window.scrollY > 400) {
            btn.classList.add('show');
        } else {
            btn.classList.remove('show');
        }
    }, { passive: true });
})();


// Daily Safety Tip
(function() {
    var tips = [
        "\u5b89\u5168\u89c2\u5bdf\uff08BBS\uff09\u7535\u6838\u5fc3\u4e0d\u662f\u201c\u6293\u8fdd\u7ae0\u201d\uff0c\u800c\u662f\u53d1\u73b0\u884c\u4e3a\u80cc\u540e\u7535\u7cfb\u7edf\u539f\u56e0\u3002\u4e00\u4e2a\u5b89\u5168\u7535\u7ec4\u7ec7\uff0c\u4e0d\u662f\u56e0\u4e3a\u6ca1\u6709\u4e0d\u5b89\u5168\u884c\u4e3a\uff0c\u800c\u662f\u56e0\u4e3a\u6709\u80fd\u53d1\u73b0\u5e76\u6539\u5584\u7535\u7cfb\u7edf\u3002",
        "LOTO\uff08\u4e0a\u9501\u6302\u724c\uff09\u662f\u9632\u6b62\u610f\u5916\u542f\u52a8\u8bbe\u5907\u7535\u6700\u6709\u6548\u624b\u6bb5\u3002\u6267\u884c\u524d\u52a1\u5fc5\u786e\u8ba4\u80fd\u91cf\u5df2\u5b8c\u5168\u9694\u79bb\uff0c\u5e76\u8fdb\u884c\u9a8c\u8bc1\u6d4b\u8bd5\u3002",
        "\u6d77\u56e0\u91cc\u5e0c\u6cd5\u5219\uff1a\u6bcf\u4e00\u8d77\u4e25\u91cd\u4e8b\u6545\u80cc\u540e\uff0c\u5e73\u5747\u670929\u6b21\u8f7b\u5fae\u4e8b\u6545\u548c300\u8d77\u672a\u9042\u5148\u5146\u3002\u91cd\u89c6\u5c0f\u4e8b\u6545\uff0c\u5c31\u662f\u9884\u9632\u5927\u707e\u96be\u3002",
        "JSA\u5de5\u4f5c\u5b89\u5168\u5206\u6790\u5e94\u5728\u65b0\u4f5c\u4e1a\u3001\u53d8\u66f4\u4f5c\u4e1a\u3001\u975e\u5e38\u89c4\u4f5c\u4e1a\u524d\u5fc5\u987b\u6267\u884c\u3002\u5927\u591a\u6570\u4e8b\u6545\u53d1\u751f\u5728\u975e\u5e38\u89c4\u4f5c\u4e1a\u573a\u666f\u3002",
        "\u4e8b\u6545\u8c03\u67e5\u75355Why\u5206\u6790\u6cd5\uff0c\u8fde\u7eed\u8ffd\u95ee5\u4e2a\u201c\u4e3a\u4ec0\u4e48\u201d\u5c31\u80fd\u89e6\u53ca\u6839\u672c\u539f\u56e0\u3002\u8bb0\u4f4f\uff1a\u8981\u95ee\u201c\u4e3a\u4ec0\u4e48\u201d\uff0c\u4e0d\u8981\u95ee\u201c\u662f\u8c01\u201d\u3002",
        "\u624b\u90e8\u4f24\u5bb3\u5360\u5de5\u4f24\u4e8b\u6545\u753530%\u4ee5\u4e0a\u3002\u6b63\u786e\u9009\u62e9\u548c\u4f7f\u7528\u624b\u5957\u662f\u6700\u57fa\u672c\u7535\u9632\u62a4\uff0c\u4f46\u5f88\u591a\u4f01\u4e1a\u5728\u8fd9\u4e00\u70b9\u4e0a\u5e76\u6ca1\u6709\u505a\u5230\u4f4d\u3002",
        "\u5e94\u6025\u9884\u5358\u7535\u6f14\u7ec3\u9891\u6b21\uff1a\u7efc\u5408\u9884\u5358\u6bcf\u5e74\u81f3\u5c111\u6b21\uff0c\u4e13\u9879\u9884\u5358\u6bcf\u534a\u5e74\u81f3\u5c111\u6b21\uff0c\u73b0\u573a\u5904\u7f6e\u65b9\u5358\u6bcf\u5b63\u5ea6\u81f3\u5c111\u6b21\u3002",
        "\u53d4\u7237\u514b\u5b89\u5168\u6587\u5316\u6a21\u578b\uff08Bradley Curve\uff09\u5c06\u5b89\u5168\u6587\u5316\u5206\u4e3a5\u4e2a\u9636\u6bb5\uff1a\u81ea\u7136\u672c\u80fd\u2192\u4f9d\u8d56\u89c4\u7ae0\u2192\u72ec\u7acb\u81ea\u4e3b\u2192\u4e92\u52a9\u56e2\u961f\u2192\u6301\u7eed\u6539\u8fdb\u3002",
        "\u5b89\u5168\u5192\u7535\u4f7f\u7528\u5e74\u9650\u4e00\u822c\u4e3a3\u5e74\uff08\u4ece\u751f\u4ea7\u65e5\u671f\u8d77\u7b97\uff09\u3002\u8d85\u671f\u4f7f\u7528\u7535\u5b89\u5168\u5192\uff0c\u62a4\u76fe\u6750\u6599\u53ef\u80fd\u5df2\u8001\u5316\uff0c\u5b89\u5168\u6027\u80fd\u5927\u5e45\u4e0b\u964d\u3002",
        "STOP5\u5e72\u9884\u6cd5\u662f\u5916\u4f01\u6700\u5e38\u7528\u7535\u4e0d\u5b89\u5168\u884c\u4e3a\u5e72\u9884\u5de5\u5177\uff1a\u505c\u4e0b\u2192\u89c2\u5bdf\u2192\u6c9f\u901a\u2192\u9632\u8303\u2192\u62a5\u544a\u3002",
        "\u526f\u8d1f\u4f5c\u4e1a\u5b89\u5168\u201c\u56db\u4e2a\u5fc5\u987b\u201d\uff1a\u5fc5\u987b\u6301\u8bc1\u4e0a\u5c97\u3001\u5fc5\u987b\u5236\u5b9a\u65bd\u5de5\u65b9\u5358\u3001\u5fc5\u987b\u8fdb\u884c\u5e95\u90e8\u9a8c\u6536\u3001\u5fc5\u987b\u6267\u884c\u9632\u62a4\u63aa\u65bd\u3002",
        "Bowtie\u8774\u8776\u7ed3\u5206\u6790\u53ef\u89c6\u5316\u5c55\u793a\u4e86\u4ece\u5371\u5bb3\u5230\u4e8b\u6545\u7535\u8def\u5f84\uff0c\u4ee5\u53ca\u5404\u7c7b\u5c4f\u969c\u7535\u4f5c\u7528\u3002\u662f\u5c42\u7ba1\u7406\u8005\u7406\u89e3\u98ce\u9669\u7535\u6700\u4f73\u53ef\u89c6\u5316\u5de5\u5177\u3002",
        "\u3010Safety Moment\u3011\u5b89\u5168\u4e0d\u662f\u4e00\u4e2a\u4eba\u7535\u4e8b\uff0c\u662f\u6574\u4e2a\u56e2\u961f\u7535\u5171\u540c\u8d23\u4efb\u3002\u5982\u679c\u770b\u5230\u540c\u4e8b\u5730\u5740\u5371\u9669\u884c\u4e3a\uff0c\u6709\u8d23\u4efb\u63d0\u9192\u5e76\u5e72\u9884\u3002",
        "PSSR\u542f\u52a8\u524d\u5b89\u5168\u68c0\u67e5\u662f\u65b0\u88c5\u7f6e\u6295\u7528\u524d\u7535\u201c\u6700\u540e\u9632\u7ebf\u201d\u3002A\u7c7b\u9879\u5fc5\u987b\u5728\u8bd5\u8f66\u524d\u5173\u95ed\uff0cB\u7c7b\u9879\u5fc5\u987b\u5728\u6295\u6599\u524d\u5173\u95ed\u3002",
        "MAC\u4eba\u5de5\u642c\u8fd0\u8bc4\u4f30\u5de5\u5177\u53ef\u4ee5\u5e2e\u52a9\u8bc4\u4f30\u624b\u52a8\u642c\u8fd0\u4f5c\u4e1a\u7535\u98ce\u9669\u7b49\u7ea7\uff0c\u9884\u9632\u808c\u8089\u9aa8\u9abc\u635f\u4f24\u3002"
    ];
    var tipEl = document.getElementById("dailyTip");
    if (tipEl) {
        var day = new Date().getDate();
        var idx = day % tips.length;
        tipEl.textContent = tips[idx];
    }
})();

// Featured Tool of the Week
(function() {
    var el = document.getElementById("featuredTool");
    if (!el) return;
    fetch("data/tools.json").then(function(r){return r.json()}).then(function(data) {
        var tools = data.tools || [];
        if (tools.length === 0) return;
        var day = new Date().getDate();
        // BBS featured 60% of the time (days 1-6, 11-16, 21-26, 31)
        var showBBS = (day % 10) >= 1 && (day % 10) <= 6;
        if (showBBS) {
            el.innerHTML = '<a href="tools/bbs-tool.html" style="color:var(--primary-dark);text-decoration:none">BBS 行为安全观察 · 免费在线工具</a>';
        } else {
            var idx = day % tools.length;
            var tool = tools[idx];
            var name = tool.name;
            if (name.length > 35) name = name.substring(0, 32) + "...";
            el.textContent = name;
        }
    }).catch(function() {
        el.innerHTML = '<a href="tools/bbs-tool.html" style="color:var(--primary-dark);text-decoration:none">BBS 行为安全观察 · 免费在线工具</a>';
    });
})();
