/**
 * EHS-SIL privacy-limited product analytics.
 *
 * This module records event names and coarse experiment context only.
 * It must never receive company names, people names, job descriptions,
 * hazards, controls, report contents, activation codes, or other user input.
 */
(function () {
    'use strict';

    var CATEGORY = 'ehs_sil_product';
    var EVENT_VERSION = '1';
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
    var funnelEvents = [
        'search_submit',
        'search_no_result',
        'search_result_click',
        'tool_start',
        'tool_complete',
        'export_click',
        'vip_gate_view',
        'vip_cta_click',
        'planet_qr_click',
        'content_to_tool'
    ];
    var diagnosticEvents = [
        'complete_scene_identification',
        'use_risk_prompt',
        'add_jsa_step',
        'view_completeness_check',
        'view_jsa_preview'
    ];
    var jsaExperimentEvents = [
        'visit_jsa',
        'start_jsa',
        'complete_scene',
        'use_prompt',
        'finish_jsa',
        'export',
        'click_member',
        'return_visit'
    ];
    var incidentExperimentEvents = [
        'visit_incident_lfi',
        'incident_resource_click'
    ];
    var trainingMatrixEvents = [
        'training_matrix_start', 'training_profile_complete', 'training_matrix_generated',
        'training_excel_export', 'training_pdf_print', 'training_reset',
        'training_toolbox_click', 'training_library_click'
    ];
    var chemicalReactivityEvents = [
        'reactivity_tool_view', 'reactivity_search_started', 'reactivity_identity_confirmed',
        'reactivity_pair_checked', 'reactivity_matrix_generated', 'reactivity_unknown_result',
        'reactivity_source_opened', 'reactivity_export_started', 'reactivity_upgrade_clicked'
    ];
    var allowedEvents = funnelEvents.concat(diagnosticEvents, jsaExperimentEvents, incidentExperimentEvents, trainingMatrixEvents, chemicalReactivityEvents);
    var legacyAliases = {
        visit_jsa_coach: 'visit_jsa',
        start_scene_identification: 'start_jsa',
        complete_scene_identification: 'complete_scene',
        use_risk_prompt: 'use_prompt',
        complete_jsa: 'finish_jsa',
        print_or_export_result: 'export',
        view_member_benefits: 'click_member',
        click_knowledge_planet: 'click_member'
    };
    var allowedPageTypes = ['tool_index', 'regulation_search', 'jsa_coach', 'compliance_tool', 'incident_lfi', 'article', 'other'];
    var allowedSourceChannels = ['direct', 'site', 'article', 'wechat', 'video', 'planet', 'other'];
    var allowedUserTiers = ['unknown', 'public', 'member', 'legacy_vip'];
    var allowedResultBuckets = ['0', '1-10', '11-50', '51+'];
    var allowedExportTypes = ['', 'print', 'xlsx'];

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

    function safeEnum(value, allowed, fallback) {
        return allowed.indexOf(value) >= 0 ? value : fallback;
    }

    function safeId(value) {
        value = String(value || '');
        return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(value) ? value : '';
    }

    function normalizeContext(context) {
        context = context || {};
        return {
            mode: context.mode === 'example' ? 'example' : 'user',
            content_id: safeId(context.contentId),
            tool_id: safeId(context.toolId),
            source_channel: safeEnum(context.sourceChannel, allowedSourceChannels, 'direct'),
            user_tier: safeEnum(context.userTier, allowedUserTiers, 'unknown'),
            page_type: safeEnum(context.pageType, allowedPageTypes, 'other'),
            result_count_bucket: safeEnum(context.resultBucket, allowedResultBuckets, ''),
            export_type: safeEnum(context.exportType, allowedExportTypes, '')
        };
    }

    function canonicalEvent(eventName) {
        return legacyAliases[eventName] || eventName;
    }

    function track(eventName, context) {
        var canonicalName = canonicalEvent(eventName);
        if (allowedEvents.indexOf(canonicalName) < 0) {
            if (window.console) console.warn('Ignored unsupported analytics event:', eventName);
            return false;
        }

        var safeContext = normalizeContext(context);
        var label = [
            'v' + EVENT_VERSION,
            userGroup(),
            safeContext.mode,
            safeContext.content_id,
            safeContext.tool_id,
            safeContext.source_channel,
            safeContext.user_tier,
            safeContext.page_type,
            safeContext.result_count_bucket,
            safeContext.export_type,
            sessionId()
        ].join('|');
        window._hmt = window._hmt || [];
        window._hmt.push(['_trackEvent', CATEGORY, canonicalName, label]);
        window.dispatchEvent(new CustomEvent('ehs-sil:analytics', {
            detail: {
                event: canonicalName,
                sourceEvent: eventName,
                version: EVENT_VERSION,
                group: userGroup(),
                context: safeContext
            }
        }));
        return true;
    }

    function trackOnce(eventName, context) {
        var key = canonicalEvent(eventName) + ':' + ((context && context.mode) || 'user');
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
        allowedEvents: allowedEvents.slice(),
        funnelEvents: funnelEvents.slice(),
        jsaExperimentEvents: jsaExperimentEvents.slice(),
        incidentExperimentEvents: incidentExperimentEvents.slice(),
        trainingMatrixEvents: trainingMatrixEvents.slice(),
        chemicalReactivityEvents: chemicalReactivityEvents.slice(),
        eventVersion: EVENT_VERSION
    };
})();
