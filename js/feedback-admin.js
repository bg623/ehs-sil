/** Protected feedback administration client. All authorization is server-side. */
(function () {
    'use strict';

    var root = document.querySelector('[data-feedback-admin-root]');
    if (!root || !window.EhsSilVip) return;
    var API_BASE = 'https://vip-api.ehs-sil.com/api/admin/feedback';
    var stateBox = root.querySelector('[data-admin-state]');
    var workspace = root.querySelector('[data-admin-workspace]');
    var list = root.querySelector('[data-admin-list]');
    var detail = root.querySelector('[data-admin-detail]');
    var filters = root.querySelector('[data-admin-filters]');
    var currentPage = 1;
    var pageSize = 20;
    var total = 0;
    var selectedId = '';
    var typeLabels = { bug: '工具问题', content_issue: '内容疑问', membership: '会员问题', feature: '功能建议', work_pain: '工作痛点', other: '其他' };
    var statusLabels = { received: '已收到', verifying: '核实中', planned: '已安排', resolved: '已解决', closed: '已关闭' };

    async function api(path, options) {
        var response = await fetch(API_BASE + (path || ''), Object.assign({
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        }, options || {}));
        var payload;
        try { payload = await response.json(); } catch (error) { payload = {}; }
        if (!response.ok) throw new Error(payload.message || '反馈管理服务暂时不可用');
        return payload;
    }

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = String(text);
        return node;
    }

    function formatTime(value) {
        if (!value) return '';
        try {
            return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value + (/[zZ]|[+-]\d\d:\d\d$/.test(value) ? '' : 'Z')));
        } catch (error) { return String(value); }
    }

    function queryString() {
        var params = new URLSearchParams({ page: String(currentPage), page_size: String(pageSize) });
        ['status', 'type', 'tool_id'].forEach(function (name) {
            var value = filters.elements[name].value.trim();
            if (value) params.set(name, value);
        });
        return '?' + params.toString();
    }

    async function loadList() {
        list.textContent = '正在读取反馈…';
        detail.innerHTML = '<p>从左侧选择一条反馈查看详情。</p>';
        selectedId = '';
        try {
            var payload = await api(queryString());
            total = payload.total || 0;
            root.querySelector('[data-admin-total]').textContent = total;
            root.querySelector('[data-admin-page]').textContent = '第 ' + currentPage + ' 页';
            root.querySelector('[data-admin-prev]').disabled = currentPage <= 1;
            root.querySelector('[data-admin-next]').disabled = currentPage * pageSize >= total;
            renderList(payload.items || []);
        } catch (error) {
            list.textContent = error.message;
        }
    }

    function renderList(items) {
        list.innerHTML = '';
        if (!items.length) {
            list.appendChild(element('p', 'feedback-admin-empty', '当前筛选条件下没有反馈。'));
            return;
        }
        items.forEach(function (item) {
            var button = element('button', 'feedback-admin-item');
            button.type = 'button';
            button.dataset.feedbackId = item.id;
            button.appendChild(element('span', 'feedback-admin-number', item.feedback_number));
            button.appendChild(element('strong', '', typeLabels[item.feedback_type] || item.feedback_type));
            button.appendChild(element('span', 'feedback-admin-preview', item.description));
            button.appendChild(element('span', 'feedback-admin-meta', (statusLabels[item.status] || item.status) + ' · ' + (item.tool_id || '网站整体') + ' · ' + formatTime(item.created_at)));
            button.addEventListener('click', function () { loadDetail(item.id); });
            list.appendChild(button);
        });
    }

    async function loadDetail(id) {
        selectedId = id;
        detail.textContent = '正在读取详情…';
        try {
            var payload = await api('/' + encodeURIComponent(id));
            renderDetail(payload.item);
        } catch (error) {
            detail.textContent = error.message;
        }
    }

    function detailRow(label, value) {
        var row = element('div', 'feedback-detail-row');
        row.appendChild(element('strong', '', label));
        row.appendChild(element('span', '', value || '—'));
        return row;
    }

    function renderDetail(item) {
        detail.innerHTML = '';
        var heading = element('div', 'feedback-detail-heading');
        heading.appendChild(element('span', 'feedback-admin-number', item.feedback_number));
        heading.appendChild(element('h2', '', typeLabels[item.feedback_type] || item.feedback_type));
        detail.appendChild(heading);
        detail.appendChild(detailRow('提交时间', formatTime(item.created_at)));
        detail.appendChild(detailRow('所属工具', item.tool_id || '网站整体'));
        detail.appendChild(detailRow('来源位置', item.source_path || '—'));
        detail.appendChild(detailRow('公开条目', item.public_entry_id || '—'));
        detail.appendChild(detailRow('已验证会员', item.verified_member ? '是' : '否或未登录'));
        detail.appendChild(detailRow('昵称', item.display_nickname || '未提供'));
        detail.appendChild(detailRow('联系方式', item.wants_reply ? (item.contact_type + ' · ' + item.contact_value) : '未请求回复'));
        if (item.reference_url) {
            var source = detailRow('参考来源', '');
            var sourceLink = element('a', '', item.reference_url);
            sourceLink.href = item.reference_url;
            sourceLink.target = '_blank';
            sourceLink.rel = 'noopener noreferrer';
            source.lastChild.replaceWith(sourceLink);
            detail.appendChild(source);
        }
        var description = element('section', 'feedback-detail-description');
        description.appendChild(element('strong', '', '用户描述'));
        description.appendChild(element('p', '', item.description));
        detail.appendChild(description);

        var form = element('form', 'feedback-admin-update');
        form.innerHTML = '<label>处理状态<select name="status"><option value="received">已收到</option><option value="verifying">核实中</option><option value="planned">已安排</option><option value="resolved">已解决</option><option value="closed">已关闭</option></select></label>' +
            '<label>内部处理备注<textarea name="internal_note" maxlength="2000" rows="4"></textarea></label>' +
            '<label>可回复用户的说明<textarea name="public_response" maxlength="2000" rows="3"></textarea></label>' +
            '<label>修复版本或关联编号<input name="resolution_ref" maxlength="120"></label>' +
            '<button type="submit" class="btn btn-primary">保存处理记录</button><div class="feedback-form-message" role="status"></div>';
        form.elements.status.value = item.status;
        form.elements.internal_note.value = item.internal_note || '';
        form.elements.public_response.value = item.public_response || '';
        form.elements.resolution_ref.value = item.resolution_ref || '';
        form.addEventListener('submit', saveDetail);
        detail.appendChild(form);
    }

    async function saveDetail(event) {
        event.preventDefault();
        var form = event.currentTarget;
        var button = form.querySelector('[type="submit"]');
        var message = form.querySelector('[role="status"]');
        button.disabled = true;
        message.textContent = '正在保存…';
        try {
            var payload = await api('/' + encodeURIComponent(selectedId), {
                method: 'PATCH',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: form.elements.status.value,
                    internal_note: form.elements.internal_note.value,
                    public_response: form.elements.public_response.value,
                    resolution_ref: form.elements.resolution_ref.value
                })
            });
            var savedId = payload.item.id;
            await loadList();
            await loadDetail(savedId);
            var savedMessage = detail.querySelector('[role="status"]');
            if (savedMessage) savedMessage.textContent = '处理记录已保存。';
        } catch (error) {
            message.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    }

    filters.addEventListener('submit', function (event) { event.preventDefault(); currentPage = 1; loadList(); });
    root.querySelector('[data-admin-prev]').addEventListener('click', function () { if (currentPage > 1) { currentPage -= 1; loadList(); } });
    root.querySelector('[data-admin-next]').addEventListener('click', function () { if (currentPage * pageSize < total) { currentPage += 1; loadList(); } });

    (async function initialise() {
        var session = await window.EhsSilVip.getSession(true);
        if (session.status === 'error') {
            stateBox.textContent = '管理员权益暂未确认：' + (session.message || '服务不可用') + '。请稍后刷新重试。';
            return;
        }
        if (!session.active) {
            stateBox.innerHTML = '<p>请先在“我的会员权益”页面验证管理员权益。</p><a class="btn btn-primary" href="register.html?returnTo=/dashboard/feedback-admin.html">前往验证权益</a>';
            return;
        }
        if (!session.capabilities.includes('feedback_admin')) {
            stateBox.textContent = '当前会员没有反馈管理权限。';
            return;
        }
        stateBox.textContent = '管理员权益已由服务端确认。';
        workspace.hidden = false;
        await loadList();
    }());
}());
