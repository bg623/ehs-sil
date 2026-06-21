(function() {
    'use strict';

    let toolsData = [];
    let filteredTools = [];
    let currentCategory = 'all';
    let searchQuery = '';

    const searchInput = document.getElementById('searchInput');
    const toolsGrid = document.getElementById('toolsGrid');
    const resultCount = document.getElementById('resultCount');
    const categoryFilters = document.getElementById('categoryFilters');
    const toolCount = document.getElementById('toolCount');

    // Format icons
    const formatIcons = {
        'pdf': '📄', 'excel': '📊', 'word': '📝',
        'ppt': '📽️', '其他': '📁'
    };

    // Load data
    fetch('../data/tools.json')
        .then(r => r.json())
        .then(data => {
            toolsData = data.tools;
            if (toolCount) toolCount.textContent = toolsData.length;
            renderCategories(data.categories.sort());
            renderTools(toolsData);
            resultCount.textContent = `${toolsData.length} 个工具`;
        })
        .catch(err => {
            toolsGrid.innerHTML = `<div class="no-results">
                <div class="no-results-icon">⚠️</div>
                <h3>工具库加载失败</h3>
                <p>请刷新页面重试</p>
            </div>`;
        });

    // Render category buttons
    function renderCategories(categories) {
        categoryFilters.innerHTML = categories.map(cat => 
            `<button class="filter-btn" data-filter="${cat}">${cat}</button>`
        ).join('');

        // Click handlers
        document.querySelectorAll('.filter-bar .filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentCategory = this.dataset.filter;
                filterTools();
            });
        });
    }

    // Filter tools
    function filterTools() {
        let results = toolsData;

        if (currentCategory !== 'all') {
            results = results.filter(t => t.category === currentCategory);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            results = results.filter(t => {
                const name = t.name.toLowerCase();
                const desc = t.description.toLowerCase();
                const tags = t.tags.join(' ').toLowerCase();
                const cat = t.category.toLowerCase();
                const path = (t.path || '').toLowerCase();
                return name.includes(query) || desc.includes(query) || 
                       tags.includes(query) || cat.includes(query) || path.includes(query);
            });
        }

        filteredTools = results;
        renderTools(results);
        resultCount.textContent = `${results.length} / ${toolsData.length} 个工具`;
    }

    // Render tool cards
    function renderTools(tools) {
        if (!tools || tools.length === 0) {
            toolsGrid.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">🔍</div>
                    <h3>没有找到匹配的工具</h3>
                    <p>试试其他关键词，或者换个分类</p>
                    <a href="https://wx.zsxq.com/group/88882255181182" target="_blank" rel="noopener" class="join-cta">
                        加入工具箱 · 获取全部 782+ 工具 →
                    </a>
                </div>`;
            return;
        }

        let html = '';
        for (const tool of tools) {
            const fmtIcon = formatIcons[tool.format] || '📁';
            const badges = [];
            badges.push(`<span class="tool-badge format-${tool.format}">${fmtIcon} ${tool.format}</span>`);
            if (tool.bilingual) {
                badges.push(`<span class="tool-badge bilingual">中英</span>`);
            }

            const tags = tool.tags.slice(0, 4).map(t => 
                `<span class="tool-tag">${t}</span>`
            ).join('');

            html += `
                <div class="tool-card">
                    <div class="tool-card-header">
                        <div class="tool-name">${escapeHtml(tool.name)}</div>
                        <div class="tool-badges">${badges.join('')}</div>
                    </div>
                    <div class="tool-desc">${escapeHtml(tool.description)}</div>
                    <div class="tool-tags">${tags}</div>
                </div>`;
        }
        toolsGrid.innerHTML = html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Debounced search
    let searchTimer;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            searchQuery = this.value;
            filterTools();
        }, 200);
    });

})();

// Filter by category (called from category cards)
function filterByCategory(category) {
    var input = document.getElementById('searchInput');
    if (input) {
        // Clear search and trigger category filter
        var allBtns = document.querySelectorAll('.filter-bar .filter-btn');
        allBtns.forEach(function(b) {
            b.classList.remove('active');
            if (b.dataset.filter === category) {
                b.classList.add('active');
            }
        });
        // Scroll to filter bar
        document.querySelector('.filter-bar').scrollIntoView({behavior: 'smooth'});
    }
}
