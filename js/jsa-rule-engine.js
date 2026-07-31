/**
 * JSA Coach deterministic rule engine.
 *
 * The engine evaluates structured, reviewed rules. It does not decide whether
 * work is safe, compliant, approved, or acceptable.
 */
(function () {
    'use strict';

    function evaluate(rule, context) {
        if (!isApplicable(rule, context)) return false;
        var condition = rule.trigger_condition || {};

        if (condition.any_selected) {
            return condition.any_selected.some(function (value) {
                return context.selectedTags.indexOf(value) >= 0;
            });
        }
        if (condition.boolean_equals) {
            return Object.keys(condition.boolean_equals).every(function (key) {
                return Boolean(context[key]) === Boolean(condition.boolean_equals[key]);
            });
        }
        if (condition.control_text_pattern) {
            var text = String(context.controlText || '').toLowerCase();
            return Boolean(text) && condition.control_text_pattern.some(function (pattern) {
                return text.indexOf(String(pattern).toLowerCase()) >= 0;
            });
        }
        if (condition.control_dependency_check) {
            var dependencyPatterns = condition.control_dependency_check.dependency_patterns || [];
            var higherOrderPatterns = condition.control_dependency_check.higher_order_patterns || [];
            var entries = context.controlEntries.length ? context.controlEntries : [context.controlText];
            return entries.some(function (entry) {
                var text = String(entry || '').toLowerCase();
                if (!text) return false;
                var hasDependency = dependencyPatterns.some(function (pattern) {
                    return text.indexOf(String(pattern).toLowerCase()) >= 0;
                });
                var hasHigherOrderControl = higherOrderPatterns.some(function (pattern) {
                    return text.indexOf(String(pattern).toLowerCase()) >= 0;
                });
                return hasDependency && !hasHigherOrderControl;
            });
        }
        if (condition.severity_at_least) {
            return Number(context.maxSeverity || 0) >= Number(condition.severity_at_least);
        }
        return false;
    }

    function isApplicable(rule, context) {
        var scenarios = rule.applicable_scenario || [];
        if (scenarios.indexOf('all') >= 0) return true;
        return scenarios.some(function (scenario) {
            return context.scenarios.indexOf(scenario) >= 0;
        });
    }

    function filterUsableRules(rules, options) {
        var includePending = Boolean(options && options.includePending);
        return (rules || []).filter(function (rule) {
            var professionallyApproved = rule.status === 'approved' &&
                Boolean(rule.reviewer && /^\d{4}-\d{2}-\d{2}$/.test(rule.review_date || ''));
            var hasGoldenCase = Array.isArray(rule.golden_case_ids) &&
                rule.golden_case_ids.length > 0;

            if (includePending) {
                return professionallyApproved ||
                    rule.status === 'pending_review' ||
                    rule.status === 'changes_requested';
            }
            return professionallyApproved &&
                rule.production_status === 'production_ready' &&
                hasGoldenCase;
        });
    }

    function evaluateRules(rules, context, options) {
        return filterUsableRules(rules, options).filter(function (rule) {
            return evaluate(rule, normalizeContext(context));
        });
    }

    function normalizeContext(context) {
        var value = context || {};
        return {
            scenarios: Array.isArray(value.scenarios) ? value.scenarios : [],
            selectedTags: Array.isArray(value.selectedTags) ? value.selectedTags : [],
            simultaneous_operations: Boolean(value.simultaneous_operations),
            contractor_work: Boolean(value.contractor_work),
            non_routine: Boolean(value.non_routine),
            controlText: String(value.controlText || ''),
            controlEntries: Array.isArray(value.controlEntries) ? value.controlEntries : [],
            maxSeverity: Number(value.maxSeverity || 0)
        };
    }

    window.JsaRuleEngine = {
        evaluateRules: evaluateRules,
        filterUsableRules: filterUsableRules,
        normalizeContext: normalizeContext
    };
})();
