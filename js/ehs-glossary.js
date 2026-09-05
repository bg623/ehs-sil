(function () {
    'use strict';

    var DATA_URL = '../assets/data/ehs-glossary.json';
    var PAGE_SIZE = 24;
    var IMPORTANCE_ORDER = { '核心': 0, '常用': 1, '进阶': 2 };
    var state = {
        data: null,
        query: '',
        category: '',
        importance: '',
        hasAbbreviation: false,
        hasSource: false,
        sort: 'relevance',
        visible: PAGE_SIZE,
        tab: 'query',
        learningMode: 'english',
        learningTerms: [],
        learningRecord: {},
        searchTimer: null,
    };

    function byId(id) { return document.getElementById(id); }
    function all(selector, parent) { return Array.prototype.slice.call((parent || document).querySelectorAll(selector)); }

    function track(eventName, context) {
        if (!window.EhsSilAnalytics) return false;
        return window.EhsSilAnalytics.track(eventName, Object.assign({
            toolId: 'ehs-glossary',
            pageType: 'glossary',
            sourceChannel: 'site',
        }, context || {}));
    }

    function trackOnce(eventName, context) {
        if (!window.EhsSilAnalytics) return false;
        return window.EhsSilAnalytics.trackOnce(eventName, Object.assign({
            toolId: 'ehs-glossary',
            pageType: 'glossary',
            sourceChannel: 'site',
        }, context || {}));
    }

    function resultBucket(count) {
        if (count === 0) return '0';
        if (count <= 10) return '1-10';
        if (count <= 50) return '11-50';
        return '51+';
    }

    function queryLanguage(value) {
        var hasChinese = /[\u3400-\u9fff]/.test(value);
        var hasLatin = /[a-z]/i.test(value);
        if (hasChinese && hasLatin) return 'mixed';
        if (hasChinese) return 'zh';
        if (hasLatin) return 'en';
        return 'none';
    }

    function normalize(value) {
        return String(value || '')
            .normalize('NFKC')
            .toLocaleLowerCase('en')
            .replace(/[\s\-‐‑‒–—―_/]+/g, '');
    }

    function isHttpUrl(value) {
        if (!value) return false;
        try {
            var url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    function scoreTerm(term, query) {
        var needle = normalize(query);
        if (!needle) return 0;
        var abbreviation = normalize(term.abbreviation);
        var english = normalize(term.english);
        var chinese = normalize(term.chinese);
        var definition = normalize(term.definition);
        var scenario = normalize(term.scenario);
        if (abbreviation && abbreviation === needle) return 1000;
        if (english === needle || chinese === needle) return 900;
        if (english.indexOf(needle) === 0 || chinese.indexOf(needle) === 0) return 700;
        if (abbreviation.indexOf(needle) >= 0 || english.indexOf(needle) >= 0 || chinese.indexOf(needle) >= 0) return 500;
        if (definition.indexOf(needle) >= 0 || scenario.indexOf(needle) >= 0) return 200;
        return -1;
    }

    function appendHighlighted(parent, value, query) {
        var text = String(value || '');
        var rawQuery = String(query || '').trim();
        if (!rawQuery) {
            parent.appendChild(document.createTextNode(text));
            return;
        }
        var index = text.toLocaleLowerCase('en').indexOf(rawQuery.toLocaleLowerCase('en'));
        if (index < 0) {
            parent.appendChild(document.createTextNode(text));
            return;
        }
        parent.appendChild(document.createTextNode(text.slice(0, index)));
        var mark = document.createElement('mark');
        mark.textContent = text.slice(index, index + rawQuery.length);
        parent.appendChild(mark);
        parent.appendChild(document.createTextNode(text.slice(index + rawQuery.length)));
    }

    function importanceClass(value) {
        if (value === '核心') return 'importance-core';
        if (value === '常用') return 'importance-common';
        return 'importance-advanced';
    }

    function createDefinition(label, value, link) {
        var wrapper = document.createElement('div');
        wrapper.className = 'term-detail';
        var dt = document.createElement('dt');
        dt.textContent = label;
        var dd = document.createElement('dd');
        if (link && isHttpUrl(value)) {
            var anchor = document.createElement('a');
            anchor.href = value;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            anchor.textContent = value;
            dd.appendChild(anchor);
        } else {
            dd.textContent = value || '—';
        }
        wrapper.append(dt, dd);
        return wrapper;
    }

    function relatedTools(term) {
        var haystack = [term.english, term.abbreviation, term.chinese].join(' ').toLocaleLowerCase('en');
        var candidates = [];
        function add(href, title) {
            if (!candidates.some(function (item) { return item.href === href; })) candidates.push({ href: href, title: title });
        }
        if (/(job safety analysis|job hazard analysis|last minute risk assessment|\bjsa\b|\bjha\b|\blmra\b)/i.test(haystack)) add('jsa-tool.html', 'JSA专业教练');
        if (/(hazop|lopa|safety integrity level|bow.?tie|\bsil\b)/i.test(haystack) || term.categoryId === '05') add('../topics/process-safety.html', '工艺安全专题');
        if (/(legal requirement|compliance evaluation|法律法规要求|合规性评价)/i.test(haystack)) add('compliance-identification.html', '法规智能识别');
        if (/(competence|training matrix|胜任|培训矩阵)/i.test(haystack)) add('training-matrix.html', '岗位EHS培训矩阵');
        if (/(learning from incident|root cause analysis|5.?why|tripod|\blfi\b|\brca\b)/i.test(haystack) || term.categoryId === '13') add('incident-learning.html', '事故学习工具');
        return candidates.slice(0, 2);
    }

    function updateDeepLink(termId, open) {
        var url = new URL(window.location.href);
        if (open) {
            url.searchParams.set('term', String(termId));
            url.hash = 'term-' + termId;
        } else if (url.searchParams.get('term') === String(termId)) {
            url.searchParams.delete('term');
            url.hash = '';
        }
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }

    function copyText(text, button) {
        function done() {
            var original = button.textContent;
            button.textContent = '已复制';
            window.setTimeout(function () { button.textContent = original; }, 1400);
        }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done).catch(function () {});
            return;
        }
        var field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        try { document.execCommand('copy'); done(); } catch (error) { /* no-op */ }
        field.remove();
    }

    function createTermCard(term, openInitially) {
        var article = document.createElement('details');
        article.className = 'term-card';
        article.id = 'term-' + term.id;
        article.open = openInitially;

        var summary = document.createElement('summary');
        summary.className = 'term-card-summary';

        var main = document.createElement('span');
        var category = document.createElement('span');
        category.className = 'term-category';
        category.textContent = term.categoryName;
        var heading = document.createElement('h3');
        appendHighlighted(heading, term.english, state.query);
        if (term.abbreviation) {
            var abbr = document.createElement('span');
            abbr.className = 'abbr-badge';
            appendHighlighted(abbr, term.abbreviation, state.query);
            heading.appendChild(abbr);
        }
        var chinese = document.createElement('span');
        chinese.className = 'term-chinese';
        appendHighlighted(chinese, term.chinese, state.query);
        var definition = document.createElement('span');
        definition.className = 'term-definition';
        appendHighlighted(definition, term.definition, state.query);
        main.append(category, heading, chinese, definition);

        var meta = document.createElement('span');
        var importance = document.createElement('span');
        importance.className = 'importance-badge ' + importanceClass(term.importance);
        importance.textContent = term.importance;
        var indicator = document.createElement('span');
        indicator.className = 'expand-indicator';
        indicator.textContent = openInitially ? '收起详情 ↑' : '展开详情 ↓';
        meta.append(importance, indicator);
        summary.append(main, meta);

        var details = document.createElement('div');
        details.id = 'term-details-' + term.id;
        details.className = 'term-details';
        var detailGrid = document.createElement('dl');
        detailGrid.className = 'term-detail-grid';
        detailGrid.append(
            createDefinition('英文术语', term.english),
            createDefinition('推荐中文', term.chinese),
            createDefinition('英文缩写', term.abbreviation),
            createDefinition('所属分类', term.categoryName),
            createDefinition('简明释义', term.definition),
            createDefinition('典型使用场景', term.scenario),
            createDefinition('口径来源', term.sourceLabel)
        );
        if (term.sourceUrl) detailGrid.appendChild(createDefinition('官方参考网址', term.sourceUrl, true));

        var actions = document.createElement('div');
        actions.className = 'term-actions';
        var copyTerm = document.createElement('button');
        copyTerm.type = 'button';
        copyTerm.textContent = '复制术语';
        copyTerm.addEventListener('click', function () {
            copyText(term.english + (term.abbreviation ? ' (' + term.abbreviation + ')' : '') + '｜' + term.chinese, copyTerm);
        });
        var copyLink = document.createElement('button');
        copyLink.type = 'button';
        copyLink.textContent = '复制本条链接';
        copyLink.addEventListener('click', function () {
            var url = new URL(window.location.href);
            url.searchParams.set('term', String(term.id));
            url.hash = 'term-' + term.id;
            copyText(url.toString(), copyLink);
        });
        actions.append(copyTerm, copyLink);
        relatedTools(term).forEach(function (tool) {
            var link = document.createElement('a');
            link.href = tool.href;
            link.textContent = tool.title + ' →';
            link.addEventListener('click', function () { track('glossary_related_tool_click', { contentId: 'term-' + term.id }); });
            actions.appendChild(link);
        });

        var related = document.createElement('div');
        related.className = 'related-terms';
        related.appendChild(document.createTextNode('相关术语：'));
        state.data.terms
            .filter(function (candidate) { return candidate.categoryId === term.categoryId && candidate.id !== term.id; })
            .sort(function (a, b) { return Math.abs(a.id - term.id) - Math.abs(b.id - term.id); })
            .slice(0, 3)
            .forEach(function (candidate) {
                var button = document.createElement('button');
                button.type = 'button';
                button.textContent = candidate.abbreviation || candidate.english;
                button.addEventListener('click', function () { setQuery(candidate.abbreviation || candidate.english, true); });
                related.appendChild(button);
            });

        details.append(detailGrid, actions, related);
        article.append(summary, details);
        article.classList.toggle('is-open', openInitially);

        article.addEventListener('toggle', function () {
            var open = article.open;
            article.classList.toggle('is-open', open);
            indicator.textContent = open ? '收起详情 ↑' : '展开详情 ↓';
            updateDeepLink(term.id, open);
            if (open) track('glossary_result_open', { contentId: 'term-' + term.id, resultCategory: term.categoryId });
        });
        return article;
    }

    function filteredTerms() {
        if (!state.data) return [];
        var rows = state.data.terms.map(function (term) { return { term: term, score: scoreTerm(term, state.query) }; })
            .filter(function (row) {
                return row.score >= 0 &&
                    (!state.category || row.term.categoryId === state.category) &&
                    (!state.importance || row.term.importance === state.importance) &&
                    (!state.hasAbbreviation || Boolean(row.term.abbreviation)) &&
                    (!state.hasSource || Boolean(row.term.sourceUrl));
            });
        rows.sort(function (a, b) {
            if (state.sort === 'importance') return IMPORTANCE_ORDER[a.term.importance] - IMPORTANCE_ORDER[b.term.importance] || a.term.id - b.term.id;
            if (state.sort === 'category') return a.term.id - b.term.id;
            if (state.sort === 'english') return a.term.english.localeCompare(b.term.english, 'en');
            return b.score - a.score || IMPORTANCE_ORDER[a.term.importance] - IMPORTANCE_ORDER[b.term.importance] || a.term.id - b.term.id;
        });
        return rows.map(function (row) { return row.term; });
    }

    function isExactAbbreviation(query) {
        var needle = normalize(query);
        return Boolean(needle && state.data && state.data.terms.some(function (term) { return normalize(term.abbreviation) === needle; }));
    }

    function renderTerms(options) {
        options = options || {};
        var container = byId('termResults');
        var terms = filteredTerms();
        var deepId = Number(new URL(window.location.href).searchParams.get('term')) || 0;
        var deepIndex = terms.findIndex(function (term) { return term.id === deepId; });
        if (deepIndex >= state.visible) state.visible = deepIndex + 1;
        container.replaceChildren();
        terms.slice(0, state.visible).forEach(function (term) { container.appendChild(createTermCard(term, term.id === deepId)); });
        if (!terms.length) {
            var empty = document.createElement('div');
            empty.className = 'empty-state';
            var heading = document.createElement('h3');
            heading.textContent = '没有找到匹配术语';
            var text = document.createElement('p');
            text.textContent = '请尝试缩写、英文全称、推荐中文，或清除筛选条件。';
            empty.append(heading, text);
            container.appendChild(empty);
        }
        var visibleCount = Math.min(state.visible, terms.length);
        byId('resultSummary').textContent = state.query
            ? '找到 ' + terms.length + ' 条结果，已显示 ' + visibleCount + ' 条'
            : '共 ' + terms.length + ' 条术语，已显示 ' + visibleCount + ' 条';
        byId('loadMore').hidden = visibleCount >= terms.length;

        var activeCount = [state.category, state.importance, state.hasAbbreviation, state.hasSource].filter(Boolean).length;
        byId('activeFilterCount').textContent = activeCount ? activeCount + '项已启用' : '';
        if (options.trackSearch && state.query) {
            track('glossary_search', {
                queryLanguage: queryLanguage(state.query),
                queryIsAbbreviation: isExactAbbreviation(state.query) ? 'yes' : 'no',
                resultBucket: resultBucket(terms.length),
                resultCategory: state.category || 'all',
            });
            if (!terms.length) track('glossary_no_result', {
                queryLanguage: queryLanguage(state.query),
                queryIsAbbreviation: isExactAbbreviation(state.query) ? 'yes' : 'no',
                resultBucket: '0',
                resultCategory: state.category || 'all',
            });
        }
        if (deepId) {
            window.requestAnimationFrame(function () {
                var target = byId('term-' + deepId);
                if (target) target.scrollIntoView({ block: 'start' });
            });
        }
    }

    function setQuery(value, shouldTrack) {
        state.query = String(value || '').trim();
        byId('glossarySearch').value = state.query;
        state.visible = PAGE_SIZE;
        activateTab('query', false);
        renderTerms({ trackSearch: shouldTrack });
        var url = new URL(window.location.href);
        if (state.query) url.searchParams.set('q', state.query); else url.searchParams.delete('q');
        url.searchParams.delete('term');
        url.hash = '';
        window.history.replaceState({}, '', url.pathname + url.search);
        byId('panel-query').scrollIntoView({ block: 'start' });
    }

    function renderAbbreviations() {
        var container = byId('abbreviationResults');
        container.replaceChildren();
        var counts = state.data.terms.reduce(function (map, term) {
            if (term.abbreviation) map[term.abbreviation] = (map[term.abbreviation] || 0) + 1;
            return map;
        }, {});
        state.data.terms.filter(function (term) { return term.abbreviation; }).forEach(function (term) {
            var card = document.createElement('article');
            card.className = 'abbreviation-card';
            var heading = document.createElement('h3');
            heading.textContent = term.abbreviation;
            if (counts[term.abbreviation] > 1) {
                var badge = document.createElement('span');
                badge.className = 'multi-meaning';
                badge.textContent = '一词多义';
                heading.appendChild(badge);
            }
            var english = document.createElement('p');
            english.className = 'english-full';
            english.textContent = term.english;
            var chinese = document.createElement('p');
            chinese.className = 'chinese-full';
            chinese.textContent = term.chinese;
            var description = document.createElement('p');
            description.className = 'abbr-description';
            description.textContent = term.definition;
            var meta = document.createElement('p');
            meta.className = 'abbr-meta';
            meta.textContent = term.categoryName + ' · ' + term.importance;
            card.append(heading, english, chinese, description, meta);
            container.appendChild(card);
        });
    }

    function renderConfusions() {
        var container = byId('confusionResults');
        container.replaceChildren();
        state.data.confusions.forEach(function (item) {
            var card = document.createElement('details');
            card.className = 'confusion-card';
            var summary = document.createElement('summary');
            summary.textContent = item.english;
            var body = document.createElement('div');
            body.className = 'confusion-body';
            var comparison = document.createElement('div');
            var comparisonLabel = document.createElement('strong');
            comparisonLabel.textContent = '中文辨析';
            var comparisonText = document.createElement('p');
            comparisonText.textContent = item.chinese;
            comparison.append(comparisonLabel, comparisonText);
            var reminder = document.createElement('div');
            var reminderLabel = document.createElement('strong');
            reminderLabel.textContent = '使用提醒';
            var reminderText = document.createElement('p');
            reminderText.textContent = item.reminder;
            reminder.append(reminderLabel, reminderText);
            body.append(comparison, reminder);
            card.append(summary, body);
            card.addEventListener('toggle', function () {
                if (card.open) track('glossary_confusion_open', { contentId: 'confusion-' + item.id });
            });
            container.appendChild(card);
        });
    }

    function localDateKey() {
        var now = new Date();
        return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    }

    function seededDailyTerms(terms, dateKey) {
        var seed = Array.from(dateKey).reduce(function (sum, character) { return (sum * 31 + character.charCodeAt(0)) >>> 0; }, 2166136261);
        var rows = terms.slice();
        function random() {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        }
        for (var index = rows.length - 1; index > 0; index -= 1) {
            var swapIndex = Math.floor(random() * (index + 1));
            var temporary = rows[index]; rows[index] = rows[swapIndex]; rows[swapIndex] = temporary;
        }
        return rows.slice(0, 10);
    }

    function learningStorageKey() { return 'ehsGlossaryLearning:' + state.data.version + ':' + localDateKey(); }

    function loadLearningRecord() {
        try { state.learningRecord = JSON.parse(localStorage.getItem(learningStorageKey()) || '{}'); }
        catch (error) { state.learningRecord = {}; }
    }

    function saveLearningRecord() {
        localStorage.setItem(learningStorageKey(), JSON.stringify(state.learningRecord));
    }

    function renderLearning() {
        var container = byId('learningCards');
        container.replaceChildren();
        state.learningTerms.forEach(function (term, index) {
            var record = state.learningRecord[term.id] || {};
            var card = document.createElement('article');
            card.className = 'learning-card' + (record.status ? ' is-' + record.status : '');
            var number = document.createElement('p');
            number.className = 'learning-number';
            number.textContent = '今日第 ' + (index + 1) + ' 词 · ' + term.categoryName;
            var heading = document.createElement('h3');
            heading.textContent = state.learningMode === 'english'
                ? term.english + (term.abbreviation ? ' (' + term.abbreviation + ')' : '')
                : term.chinese;
            var answer = document.createElement('p');
            answer.className = 'learning-answer';
            answer.hidden = !record.revealed;
            answer.textContent = state.learningMode === 'english'
                ? term.chinese + '：' + term.definition
                : term.english + (term.abbreviation ? ' (' + term.abbreviation + ')' : '') + '：' + term.definition;
            var actions = document.createElement('div');
            actions.className = 'learning-actions';
            var reveal = document.createElement('button');
            reveal.type = 'button';
            reveal.textContent = record.revealed ? '隐藏答案' : '查看答案';
            reveal.addEventListener('click', function () {
                record.revealed = !record.revealed;
                state.learningRecord[term.id] = record;
                saveLearningRecord();
                renderLearning();
            });
            var known = document.createElement('button');
            known.type = 'button';
            known.textContent = '我认识';
            known.addEventListener('click', function () { updateLearning(term.id, 'known'); });
            var review = document.createElement('button');
            review.type = 'button';
            review.textContent = '需要复习';
            review.addEventListener('click', function () { updateLearning(term.id, 'review'); });
            actions.append(reveal, known, review);
            card.append(number, heading, answer, actions);
            container.appendChild(card);
        });
        var complete = state.learningTerms.filter(function (term) { return state.learningRecord[term.id] && state.learningRecord[term.id].status; }).length;
        byId('learningProgress').textContent = '今日进度 ' + complete + '/10';
        if (complete === 10 && !state.learningRecord.completed) {
            state.learningRecord.completed = true;
            saveLearningRecord();
            track('glossary_learning_complete', { resultBucket: '1-10' });
        }
    }

    function updateLearning(termId, status) {
        var record = state.learningRecord[termId] || {};
        record.status = status;
        record.revealed = true;
        state.learningRecord[termId] = record;
        saveLearningRecord();
        renderLearning();
    }

    function activateTab(tabName, focus) {
        state.tab = tabName;
        all('[role="tab"]').forEach(function (tab) {
            var selected = tab.dataset.tab === tabName;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
            if (selected && focus) tab.focus();
        });
        all('[role="tabpanel"]').forEach(function (panel) { panel.hidden = panel.id !== 'panel-' + tabName; });
        if (tabName === 'learning') trackOnce('glossary_learning_start');
        var url = new URL(window.location.href);
        if (tabName === 'query') url.searchParams.delete('view'); else url.searchParams.set('view', tabName);
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }

    function populateCategories() {
        var select = byId('categoryFilter');
        state.data.categories.forEach(function (category) {
            var option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.id + ' ' + category.name + '（' + category.count + '）';
            select.appendChild(option);
        });
    }

    function validateData(data) {
        if (!data || data.total !== 445 || data.categoryTotal !== 18 || data.abbreviationTotal !== 196 || data.confusionTotal !== 24) {
            throw new Error('术语数据版本或数量不符合发布契约');
        }
        if (data.terms.some(function (term) { return term.abbreviation === 57 || term.abbreviation === '57' || term.sourceUrl === 57 || term.sourceUrl === '57'; })) {
            throw new Error('术语数据包含错误的57空值占位');
        }
    }

    function bindEvents() {
        byId('glossarySearchForm').addEventListener('submit', function (event) {
            event.preventDefault();
            window.clearTimeout(state.searchTimer);
            setQuery(byId('glossarySearch').value, true);
        });
        byId('glossarySearch').addEventListener('input', function (event) {
            state.query = event.target.value.trim();
            state.visible = PAGE_SIZE;
            renderTerms();
            window.clearTimeout(state.searchTimer);
            state.searchTimer = window.setTimeout(function () {
                if (state.query) renderTerms({ trackSearch: true });
            }, 500);
        });
        all('[data-quick-query]').forEach(function (button) {
            button.addEventListener('click', function () { setQuery(button.dataset.quickQuery, true); });
        });
        byId('categoryFilter').addEventListener('change', function (event) { state.category = event.target.value; state.visible = PAGE_SIZE; renderTerms(); track('glossary_filter', { filterType: 'category', resultCategory: state.category || 'all' }); });
        byId('importanceFilter').addEventListener('change', function (event) { state.importance = event.target.value; state.visible = PAGE_SIZE; renderTerms(); track('glossary_filter', { filterType: 'importance' }); });
        byId('abbrFilter').addEventListener('change', function (event) { state.hasAbbreviation = event.target.checked; state.visible = PAGE_SIZE; renderTerms(); track('glossary_filter', { filterType: 'abbreviation' }); });
        byId('sourceFilter').addEventListener('change', function (event) { state.hasSource = event.target.checked; state.visible = PAGE_SIZE; renderTerms(); track('glossary_filter', { filterType: 'source' }); });
        byId('sortOrder').addEventListener('change', function (event) { state.sort = event.target.value; renderTerms(); });
        byId('clearFilters').addEventListener('click', function () {
            state.category = ''; state.importance = ''; state.hasAbbreviation = false; state.hasSource = false; state.visible = PAGE_SIZE;
            byId('categoryFilter').value = ''; byId('importanceFilter').value = ''; byId('abbrFilter').checked = false; byId('sourceFilter').checked = false;
            renderTerms();
        });
        byId('loadMore').addEventListener('click', function () { state.visible += PAGE_SIZE; renderTerms(); });
        all('[role="tab"]').forEach(function (tab) {
            tab.addEventListener('click', function () { activateTab(tab.dataset.tab, false); });
            tab.addEventListener('keydown', function (event) {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                var tabs = all('[role="tab"]');
                var index = tabs.indexOf(tab);
                var next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
                event.preventDefault();
                activateTab(tabs[next].dataset.tab, true);
            });
        });
        all('[data-learning-mode]').forEach(function (button) {
            button.addEventListener('click', function () {
                state.learningMode = button.dataset.learningMode;
                all('[data-learning-mode]').forEach(function (item) {
                    var active = item === button;
                    item.classList.toggle('active', active);
                    item.setAttribute('aria-pressed', String(active));
                });
                renderLearning();
            });
        });
        all('[data-glossary-download]').forEach(function (link) {
            link.addEventListener('click', function () {
                byId('downloadGuide').hidden = false;
                track('glossary_download', { exportType: 'xlsx' });
            });
        });
        all('[data-membership-link]').forEach(function (link) {
            link.addEventListener('click', function () { track('glossary_membership_click', { contentId: 'toolbox' }); });
        });
    }

    async function start() {
        bindEvents();
        if (window.matchMedia('(max-width: 900px)').matches) byId('filterPanel').open = false;
        try {
            var response = await fetch(DATA_URL, { credentials: 'same-origin' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            state.data = await response.json();
            validateData(state.data);
            populateCategories();
            var url = new URL(window.location.href);
            state.query = url.searchParams.get('q') || '';
            byId('glossarySearch').value = state.query;
            state.learningTerms = seededDailyTerms(state.data.terms, localDateKey());
            loadLearningRecord();
            renderTerms();
            renderAbbreviations();
            renderConfusions();
            renderLearning();
            var initialView = url.searchParams.get('view');
            if (['abbreviations', 'confusions', 'learning'].indexOf(initialView) >= 0) activateTab(initialView, false);
            trackOnce('glossary_view', { resultBucket: '51+' });
        } catch (error) {
            var status = byId('glossaryStatus');
            status.hidden = false;
            status.classList.add('error');
            status.textContent = '完整术语数据暂时无法加载。当前仍可浏览页面内预置的核心术语，请稍后重试。';
            byId('resultSummary').textContent = '完整数据加载失败，当前显示核心术语';
            if (window.console) console.error(error);
        }
    }

    start();
})();
