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
