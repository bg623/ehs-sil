/**
 * JSA rule review workflow helpers.
 *
 * Review decisions are intentionally kept separate from the production rule
 * file. A product-owner approval still requires golden-case coverage and
 * regression testing before a rule can be published.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.EhsSilJsaReview = api;
}(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    var DECISIONS = ['pending', 'approved', 'needs_revision', 'rejected'];

    function normalizeText(value) {
        return String(value == null ? '' : value).trim();
    }

    function isIsoDate(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(normalizeText(value));
    }

    function isUsableSource(value) {
        var source = normalizeText(value);
        return Boolean(source) && !/待.*补充|待.*审核/.test(source);
    }

    function emptyReview(rule) {
        return {
            rule_id: rule.rule_id,
            rule_version: rule.version,
            decision: 'pending',
            source: rule.source || '',
            comments: ''
        };
    }

    function createReviewState(ruleset, savedState) {
        var savedById = {};
        var savedReviews = savedState && Array.isArray(savedState.reviews)
            ? savedState.reviews
            : [];

        savedReviews.forEach(function (review) {
            if (review && review.rule_id) savedById[review.rule_id] = review;
        });

        return {
            schema_version: '1.0',
            ruleset_version: ruleset.ruleset_version,
            reviewer: normalizeText(savedState && savedState.reviewer),
            review_date: normalizeText(savedState && savedState.review_date),
            reviews: ruleset.rules.map(function (rule) {
                var review = Object.assign(emptyReview(rule), savedById[rule.rule_id] || {});
                review.rule_id = rule.rule_id;
                review.rule_version = rule.version;
                if (DECISIONS.indexOf(review.decision) < 0) review.decision = 'pending';
                review.source = normalizeText(review.source);
                review.comments = normalizeText(review.comments);
                return review;
            })
        };
    }

    function validateReview(record, metadata, ruleIds) {
        var errors = [];
        var decision = normalizeText(record && record.decision);
        var ruleId = normalizeText(record && record.rule_id);

        if (!ruleIds.has(ruleId)) errors.push('规则编号不存在');
        if (DECISIONS.indexOf(decision) < 0) errors.push('审核结论无效');
        if (decision === 'pending') return errors;

        if (!normalizeText(metadata && metadata.reviewer)) errors.push('请填写审核人');
        if (!isIsoDate(metadata && metadata.review_date)) errors.push('请填写有效审核日期');

        if (decision === 'approved' && !isUsableSource(record.source)) {
            errors.push('批准前需要补充可追溯的专业来源');
        }
        if (
            (decision === 'needs_revision' || decision === 'rejected') &&
            !normalizeText(record.comments)
        ) {
            errors.push('需要填写修改或拒绝原因');
        }
        return errors;
    }

    function summarize(reviews) {
        return reviews.reduce(function (summary, record) {
            var decision = DECISIONS.indexOf(record.decision) >= 0
                ? record.decision
                : 'pending';
            summary[decision] += 1;
            return summary;
        }, {pending: 0, approved: 0, needs_revision: 0, rejected: 0});
    }

    function buildExport(ruleset, state, generatedAt) {
        var ruleIds = new Set(ruleset.rules.map(function (rule) { return rule.rule_id; }));
        var errors = [];

        state.reviews.forEach(function (record) {
            validateReview(record, state, ruleIds).forEach(function (message) {
                errors.push(record.rule_id + '：' + message);
            });
        });

        if (errors.length) {
            var error = new Error(errors.join('\n'));
            error.validationErrors = errors;
            throw error;
        }

        return {
            schema_version: '1.0',
            export_type: 'jsa_product_owner_review',
            ruleset_version: ruleset.ruleset_version,
            reviewer: normalizeText(state.reviewer),
            review_date: normalizeText(state.review_date),
            generated_at: generatedAt || new Date().toISOString(),
            notice: '本文件记录产品负责人审核意见，不代表规则已通过黄金案例或生产发布门槛。',
            summary: summarize(state.reviews),
            reviews: state.reviews.map(function (record) {
                return {
                    rule_id: record.rule_id,
                    rule_version: record.rule_version,
                    decision: record.decision,
                    source: normalizeText(record.source),
                    comments: normalizeText(record.comments),
                    reviewer: record.decision === 'pending' ? null : normalizeText(state.reviewer),
                    review_date: record.decision === 'pending' ? null : normalizeText(state.review_date)
                };
            })
        };
    }

    function describeTrigger(trigger) {
        if (!trigger || typeof trigger !== 'object') return '未定义';
        if (Array.isArray(trigger.any_selected)) {
            return '当任一危险或场景被选中：' + trigger.any_selected.join('、');
        }
        if (trigger.boolean_equals) {
            return Object.keys(trigger.boolean_equals).map(function (key) {
                return key + ' = ' + (trigger.boolean_equals[key] ? '是' : '否');
            }).join('；');
        }
        if (Array.isArray(trigger.control_text_pattern)) {
            return '当控制措施包含：' + trigger.control_text_pattern.join('、');
        }
        if (trigger.severity_at_least != null) {
            return '当后果等级不低于 ' + trigger.severity_at_least;
        }
        return JSON.stringify(trigger);
    }

    return {
        decisions: DECISIONS.slice(),
        createReviewState: createReviewState,
        validateReview: validateReview,
        summarize: summarize,
        buildExport: buildExport,
        describeTrigger: describeTrigger,
        isUsableSource: isUsableSource
    };
}));
