/**
 * EHS-SIL privacy-limited product analytics.
 *
 * This module records event names and coarse experiment context only.
 * It must never receive company names, people names, job descriptions,
 * hazards, controls, report contents, activation codes, or other user input.
 */
(function () {
    'use strict';

    var CATEGORY = 'jsa_coach';
    var GROUP_KEY = 'ehs_sil_experiment_group';
    var SESSION_KEY = 'ehs_sil_analytics_session';
    var ONCE_KEY = 'ehs_sil_analytics_once';
    var allowedGroups = [
        'toolbox_member',
        'public_non_member',
        'ehs_supervisor_manager',
        'junior_ehs',
        'unknown'
    ];
    var allowedEvents = [
        'visit_jsa_coach',
        'start_scene_identification',
        'complete_scene_identification',
        'use_risk_prompt',
        'add_jsa_step',
        'complete_jsa',
        'view_completeness_check',
        'view_jsa_preview',
        'print_or_export_result',
        'view_member_benefits',
        'click_knowledge_planet'
    ];

    function sessionId() {
        var value = sessionStorage.getItem(SESSION_KEY);
        if (value) return value;
        value = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem(SESSION_KEY, value);
        return value;
    }

    function userGroup() {
        var value = localStorage.getItem(GROUP_KEY) || 'unknown';
        return allowedGroups.indexOf(value) >= 0 ? value : 'unknown';
    }

    function track(eventName, context) {
        if (allowedEvents.indexOf(eventName) < 0) {
            if (window.console) console.warn('Ignored unsupported analytics event:', eventName);
            return false;
        }

        var safeContext = context && context.mode === 'example' ? 'example' : 'user';
        var label = [userGroup(), safeContext, sessionId()].join('|');
        window._hmt = window._hmt || [];
        window._hmt.push(['_trackEvent', CATEGORY, eventName, label]);
        window.dispatchEvent(new CustomEvent('ehs-sil:analytics', {
            detail: { event: eventName, group: userGroup(), mode: safeContext }
        }));
        return true;
    }

    function trackOnce(eventName, context) {
        var key = eventName + ':' + ((context && context.mode) || 'user');
        var seen;
        try {
            seen = JSON.parse(sessionStorage.getItem(ONCE_KEY) || '{}');
        } catch (error) {
            seen = {};
        }
        if (seen[key]) return false;
        seen[key] = true;
        sessionStorage.setItem(ONCE_KEY, JSON.stringify(seen));
        return track(eventName, context);
    }

    function setExperimentGroup(group) {
        if (allowedGroups.indexOf(group) < 0) throw new Error('不支持的实验用户分组');
        localStorage.setItem(GROUP_KEY, group);
    }

    window.EhsSilAnalytics = {
        track: track,
        trackOnce: trackOnce,
        getGroup: userGroup,
        setGroup: setExperimentGroup,
        allowedEvents: allowedEvents.slice()
    };
})();
