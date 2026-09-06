/** EHS-SIL privacy-limited feedback form and in-page dialog. */
(function () {
    'use strict';

    var API_URL = 'https://vip-api.ehs-sil.com/api/feedback';
    var REQUEST_TIMEOUT_MS = 15000;
    var feedbackTypes = ['bug', 'content_issue', 'membership', 'feature', 'work_pain', 'other'];
    var typePrompts = {
        bug: '做到哪一步？发生了什么？希望出现什么结果？',
        content_issue: '哪条法规、岗位或培训要求需要核对？如有官方来源可一并提供。',
        membership: '是激活失败、状态不明确，还是会员下载无法使用？请勿填写激活码。',
        feature: '你想完成什么任务？现在卡在哪里？',
        work_pain: '多久遇到一次？目前怎么处理？最想节省哪一步？',
        other: '请简要描述你希望我们了解的情况。'
    };
    var toolMap = {
        '/tools/jsa-tool.html': ['jsa-coach', 'JSA 工作安全分析专业教练'],
        '/tools/compliance-identification.html': ['compliance-identification', '企业适用法规识别'],
        '/tools/training-matrix.html': ['training-matrix', '岗位 EHS 培训矩阵'],
        '/tools/ehs-glossary.html': ['ehs-glossary', '外企 EHS 专业术语库'],
        '/tools/index.html': ['tool-index', '工具与培训资料索引'],
        '/tools/chemical-reactivity-matrix.html': ['chemical-reactivity', '化学品反应与禁忌矩阵'],
        '/tools/risk-analysis.html': ['risk-analysis', '风险分析与事故调查工具'],
        '/tools/incident-learning.html': ['incident-learning', '事故调查与 LFI 闭环']
    };
    var activeDialog = null;
    var returnFocus = null;

    function safeId(value, max) {
        var text = String(value || '');
        return new RegExp('^[a-z0-9][a-z0-9_-]{0,' + ((max || 60) - 1) + '}$').test(text) ? text : '';
    }

    function safeVersion(value) {
        var text = String(value || '');
        return /^[A-Za-z0-9._:-]{1,40}$/.test(text) ? text : '';
    }

    function safePublicId(value) {
        var text = String(value || '');
        return /^[A-Za-z0-9._:-]{1,80}$/.test(text) ? text : '';
    }

    function safeSourcePath(value) {
        try {
            var parsed = new URL(value || location.pathname, location.origin);
            if (parsed.origin !== location.origin || parsed.pathname.indexOf('\\') >= 0) return '';
            if (!/^\/(?:$|index\.html$|tools\/|dashboard\/register\.html$|feedback\.html$)/.test(parsed.pathname)) return '';
            return parsed.pathname;
        } catch (error) {
            return '';
        }
    }

    function inferTool(pathname) {
        return toolMap[pathname] || ['', pathname === '/index.html' || pathname === '/' ? '网站整体' : '网站页面'];
    }

    function contextFromLocation() {
        var query = new URLSearchParams(location.search);
        var inferred = inferTool(location.pathname);
        var type = query.get('type');
        return {
            feedbackType: feedbackTypes.indexOf(type) >= 0 ? type : '',
            toolId: safeId(query.get('tool')) || inferred[0],
            toolName: inferred[1],
            sourceEntry: safeId(query.get('entry'), 40) || (location.pathname === '/feedback.html' ? 'direct' : 'page'),
            sourcePath: safeSourcePath(query.get('from') || location.pathname),
            toolVersion: safeVersion(query.get('toolVersion')),
            dataVersion: safeVersion(query.get('dataVersion')),
            publicEntryId: safePublicId(query.get('id'))
        };
    }

    function contextFromLink(link) {
        var base = contextFromLocation();
        var href;
        try { href = new URL(link.getAttribute('href') || '', location.href); } catch (error) { href = null; }
        if (href) {
            var requestedType = href.searchParams.get('type');
            if (feedbackTypes.indexOf(requestedType) >= 0) base.feedbackType = requestedType;
            base.toolId = safeId(href.searchParams.get('tool')) || safeId(link.dataset.feedbackTool) || base.toolId;
            base.sourceEntry = safeId(href.searchParams.get('entry'), 40) || safeId(link.dataset.feedbackEntry, 40) || base.sourceEntry;
            base.toolVersion = safeVersion(href.searchParams.get('toolVersion')) || safeVersion(link.dataset.toolVersion) || base.toolVersion;
            base.dataVersion = safeVersion(href.searchParams.get('dataVersion')) || safeVersion(link.dataset.dataVersion) || base.dataVersion;
            base.publicEntryId = safePublicId(href.searchParams.get('id')) || safePublicId(link.dataset.publicEntryId) || base.publicEntryId;
        }
        base.sourcePath = safeSourcePath(location.pathname);
        return base;
    }

    function randomRequestId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
        var bytes = new Uint8Array(18);
        if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
            window.crypto.getRandomValues(bytes);
            return 'req_' + Array.from(bytes).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
        }
        return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }

    function nickname() {
        if (window.EhsSilMembershipUI) return window.EhsSilMembershipUI.getNickname();
        try { return localStorage.getItem('ehs_display_nickname_v1') || ''; } catch (error) { return ''; }
    }

    function formMarkup() {
        return '<form class="feedback-form" data-feedback-form novalidate>' +
            '<div class="feedback-context" data-feedback-context></div>' +
            '<label>反馈类型 <span aria-hidden="true">*</span><select name="feedback_type" required>' +
            '<option value="">请选择</option><option value="bug">工具用不了 / 操作问题</option>' +
            '<option value="content_issue">结果或专业内容有疑问</option><option value="membership">激活 / 会员权益问题</option>' +
            '<option value="feature">希望增加功能 / 改进建议</option><option value="work_pain">工作中遇到的痛点</option>' +
            '<option value="other">其他反馈</option></select></label>' +
            '<label>问题描述 <span aria-hidden="true">*</span><textarea name="description" minlength="10" maxlength="2000" rows="6" required placeholder="请描述发生了什么，以及你希望得到什么结果"></textarea>' +
            '<span class="feedback-field-help" data-feedback-prompt>建议 10–2000 字</span></label>' +
            '<div class="feedback-grid"><label>所属工具或页面<select name="tool_id_choice">' +
            '<option value="">网站整体</option><option value="jsa-coach">JSA 工作安全分析专业教练</option>' +
            '<option value="compliance-identification">企业适用法规识别</option><option value="training-matrix">岗位 EHS 培训矩阵</option>' +
            '<option value="ehs-glossary">外企 EHS 专业术语库</option><option value="tool-index">工具与培训资料索引</option>' +
            '<option value="chemical-reactivity">化学品反应与禁忌矩阵</option><option value="risk-analysis">风险分析与事故调查工具</option>' +
            '<option value="incident-learning">事故调查与 LFI 闭环</option></select></label>' +
            '<label>公开条目编号（可选）<input name="public_entry_id" type="text" maxlength="80" placeholder="例如法规编号或课程编号"></label></div>' +
            '<label>专业来源或参考网址（可选）<input name="reference_url" type="url" maxlength="500" placeholder="https://..."></label>' +
            '<label>昵称（可选）<input name="display_nickname" type="text" maxlength="20" autocomplete="nickname" placeholder="仅用于辨认本条反馈"></label>' +
            '<label class="feedback-check"><input name="wants_reply" type="checkbox"> 希望主理人通过我留下的方式回复</label>' +
            '<div class="feedback-contact" data-feedback-contact hidden><label>联系方式<select name="contact_type"><option value="wechat">微信</option><option value="email">邮箱</option></select></label>' +
            '<label>联系信息<input name="contact_value" type="text" maxlength="160" autocomplete="off" placeholder="仅用于跟进本条反馈"></label></div>' +
            '<p class="feedback-privacy">请描述经过脱敏的问题，不要提交激活码、密码、人员资料或企业机密。主动提交的上述内容会送达 EHS-SIL 主理人，仅用于本条反馈处理。</p>' +
            '<div class="feedback-actions"><button type="submit" class="btn btn-primary">提交反馈</button><button type="button" class="btn btn-secondary" data-feedback-cancel>取消</button></div>' +
            '<div class="feedback-form-message" data-feedback-message role="status" aria-live="polite"></div>' +
            '</form><section class="feedback-receipt" data-feedback-receipt hidden tabindex="-1"><div class="feedback-receipt-icon">✓</div>' +
            '<h2>已收到你的反馈</h2><p>反馈编号：<strong data-feedback-number></strong></p><p data-feedback-reply-note></p>' +
            '<div class="feedback-actions"><button type="button" class="btn btn-secondary" data-feedback-copy>复制编号</button>' +
            '<button type="button" class="btn btn-primary" data-feedback-continue>继续使用工具</button></div>' +
            '<div class="feedback-form-message" data-feedback-copy-message role="status" aria-live="polite"></div></section>';
    }

    function mount(container, context) {
        container.innerHTML = formMarkup();
        var form = container.querySelector('[data-feedback-form]');
        var type = form.elements.feedback_type;
        var description = form.elements.description;
        var contextBox = form.querySelector('[data-feedback-context]');
        var contact = form.querySelector('[data-feedback-contact]');
        var message = form.querySelector('[data-feedback-message]');
        var submit = form.querySelector('[type="submit"]');
        form.dataset.requestId = randomRequestId();
        type.value = context.feedbackType || '';
        form.elements.tool_id_choice.value = context.toolId || '';
        form.elements.public_entry_id.value = context.publicEntryId || '';
        form.elements.display_nickname.value = nickname();
        contextBox.textContent = '提交位置：' + (context.toolName || '网站整体') + (context.publicEntryId ? ' · 条目 ' + context.publicEntryId : '');
        form.elements.tool_id_choice.addEventListener('change', function () {
            var selected = form.elements.tool_id_choice.options[form.elements.tool_id_choice.selectedIndex];
            contextBox.textContent = '提交位置：' + selected.textContent + (form.elements.public_entry_id.value ? ' · 条目 ' + form.elements.public_entry_id.value : '');
        });

        function updatePrompt() {
            form.querySelector('[data-feedback-prompt]').textContent = typePrompts[type.value] || '建议 10–2000 字';
        }
        type.addEventListener('change', updatePrompt);
        updatePrompt();
        form.elements.wants_reply.addEventListener('change', function () {
            contact.hidden = !form.elements.wants_reply.checked;
            form.elements.contact_value.required = form.elements.wants_reply.checked;
        });
        form.querySelector('[data-feedback-cancel]').addEventListener('click', closeDialog);
        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            if (!form.reportValidity()) return;
            if (description.value.trim().length < 10) {
                message.textContent = '问题描述至少需要 10 个字符。';
                description.focus();
                return;
            }
            submit.disabled = true;
            submit.textContent = '正在提交…';
            message.textContent = '';
            var payload = {
                request_id: form.dataset.requestId,
                feedback_type: type.value,
                description: description.value,
                tool_id: safeId(form.elements.tool_id_choice.value),
                source_entry: context.sourceEntry,
                source_path: context.sourcePath,
                tool_version: context.toolVersion,
                data_version: context.dataVersion,
                public_entry_id: safePublicId(form.elements.public_entry_id.value),
                reference_url: form.elements.reference_url.value.trim(),
                wants_reply: form.elements.wants_reply.checked,
                contact_type: form.elements.wants_reply.checked ? form.elements.contact_type.value : null,
                contact_value: form.elements.wants_reply.checked ? form.elements.contact_value.value.trim() : null,
                display_nickname: form.elements.display_nickname.value.trim()
            };
            try {
                var receipt = await submitFeedback(payload);
                form.hidden = true;
                var receiptPanel = container.querySelector('[data-feedback-receipt]');
                receiptPanel.hidden = false;
                receiptPanel.querySelector('[data-feedback-number]').textContent = receipt.feedback_number;
                receiptPanel.querySelector('[data-feedback-reply-note]').textContent = payload.wants_reply ? '需要补充信息或有处理结果时，我们会通过你所留的方式联系。' : '主理人会在反馈列表中核实并安排处理。';
                receiptPanel.dataset.feedbackNumber = receipt.feedback_number;
                receiptPanel.focus();
                track('feedback_submit_success', context, type.value);
            } catch (error) {
                message.textContent = error.message + ' 当前填写内容仍保留，可直接重试。';
                submit.disabled = false;
                submit.textContent = '重新提交';
                track('feedback_submit_failed', context, type.value, error.code || 'network');
            }
        });
        var receiptPanel = container.querySelector('[data-feedback-receipt]');
        receiptPanel.querySelector('[data-feedback-copy]').addEventListener('click', async function () {
            var text = receiptPanel.dataset.feedbackNumber || '';
            try {
                await navigator.clipboard.writeText(text);
                receiptPanel.querySelector('[data-feedback-copy-message]').textContent = '反馈编号已复制。';
            } catch (error) {
                receiptPanel.querySelector('[data-feedback-copy-message]').textContent = '请手动记录反馈编号：' + text;
            }
        });
        receiptPanel.querySelector('[data-feedback-continue]').addEventListener('click', function () {
            if (activeDialog) closeDialog();
            else if (context.sourcePath && context.sourcePath !== '/feedback.html') location.href = context.sourcePath;
            else location.href = '/index.html#workbench';
        });
        return form;
    }

    async function submitFeedback(payload) {
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timeout = controller ? setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS) : null;
        var response;
        try {
            response = await fetch(API_URL, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller ? controller.signal : undefined
            });
        } catch (error) {
            if (timeout) clearTimeout(timeout);
            var requestError = new Error(error && error.name === 'AbortError' ? '提交超时，服务端可能已经收到' : '暂时无法连接反馈服务');
            requestError.code = error && error.name === 'AbortError' ? 'timeout' : 'network';
            throw requestError;
        }
        if (timeout) clearTimeout(timeout);
        var body;
        try { body = await response.json(); } catch (error) { body = {}; }
        if (!response.ok) {
            var failure = new Error(body.message || '反馈提交失败，请重试');
            failure.code = response.status === 429 ? 'rate_limit' : response.status >= 500 ? 'server' : 'validation';
            throw failure;
        }
        return body;
    }

    function openDialog(context, trigger) {
        if (activeDialog) closeDialog();
        returnFocus = trigger || document.activeElement;
        var dialog = document.createElement('dialog');
        dialog.className = 'feedback-dialog';
        dialog.setAttribute('aria-labelledby', 'feedbackDialogTitle');
        dialog.innerHTML = '<div class="feedback-dialog-card"><div class="feedback-dialog-head"><div><span class="section-label">用户反馈</span><h2 id="feedbackDialogTitle">告诉我们哪里需要改进</h2></div>' +
            '<button type="button" class="feedback-dialog-close" aria-label="关闭反馈表单">×</button></div><div data-feedback-dialog-body></div></div>';
        document.body.appendChild(dialog);
        activeDialog = dialog;
        mount(dialog.querySelector('[data-feedback-dialog-body]'), context);
        dialog.querySelector('.feedback-dialog-close').addEventListener('click', closeDialog);
        dialog.addEventListener('cancel', function (event) { event.preventDefault(); closeDialog(); });
        dialog.addEventListener('click', function (event) { if (event.target === dialog) closeDialog(); });
        dialog.addEventListener('keydown', trapFocus);
        dialog.showModal();
        document.body.classList.add('feedback-open');
        dialog.querySelector('select').focus();
        track('feedback_open', context, context.feedbackType || 'other');
    }

    function closeDialog() {
        if (!activeDialog) return;
        var dialog = activeDialog;
        activeDialog = null;
        document.body.classList.remove('feedback-open');
        dialog.close();
        dialog.remove();
        if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
        returnFocus = null;
    }

    function trapFocus(event) {
        if (event.key !== 'Tab' || !activeDialog) return;
        var focusable = activeDialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    function track(eventName, context, feedbackType, errorType) {
        if (!window.EhsSilAnalytics) return;
        var pageType = location.pathname === '/feedback.html' ? 'feedback' :
            location.pathname.indexOf('/dashboard/') === 0 ? 'membership' :
            location.pathname.indexOf('/tools/compliance-identification') === 0 ? 'compliance_tool' :
            location.pathname.indexOf('/tools/jsa-tool') === 0 ? 'jsa_coach' :
            location.pathname.indexOf('/tools/ehs-glossary') === 0 ? 'glossary' : 'other';
        window.EhsSilAnalytics.track(eventName, {
            toolId: context.toolId,
            sourceEntry: context.sourceEntry,
            feedbackType: feedbackTypes.indexOf(feedbackType) >= 0 ? feedbackType : 'other',
            errorType: errorType || '',
            pageType: pageType,
            sourceChannel: 'site'
        });
    }

    function injectToolLink() {
        var tool = inferTool(location.pathname);
        if (!tool[0] || document.querySelector('[data-feedback-tool-link]')) return;
        var heading = document.querySelector('main h1, .container h1, h1');
        if (!heading) return;
        var link = document.createElement('a');
        link.href = '/feedback.html?tool=' + encodeURIComponent(tool[0]) + '&entry=tool-title&from=' + encodeURIComponent(location.pathname);
        link.className = 'tool-feedback-link';
        link.dataset.feedbackOpen = '';
        link.dataset.feedbackToolLink = '';
        link.dataset.feedbackTool = tool[0];
        link.dataset.feedbackEntry = 'tool-title';
        link.textContent = '反馈此工具';
        heading.insertAdjacentElement('afterend', link);
    }

    document.addEventListener('click', function (event) {
        var link = event.target.closest('[data-feedback-open]');
        if (!link) return;
        event.preventDefault();
        openDialog(contextFromLink(link), link);
    });

    document.querySelectorAll('[data-feedback-page]').forEach(function (container) {
        mount(container, contextFromLocation());
    });
    injectToolLink();

    window.EhsSilFeedback = { open: openDialog, submit: submitFeedback };
}());
