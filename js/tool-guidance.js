/** Verified presentation only. This catalog never grants membership or reads work data. */
(function () {
  'use strict';
  var catalog = {
    'jsa-tool.html': {
      id: 'jsa-coach', version: '0.2', status: '免费可用 · 试用版',
      output: 'JSA 底稿 / Excel / 打印', storage: '仅当前页，不自动保存', rights: '无需会员',
      purpose: '作业前梳理步骤、危害与控制措施；不用于批准作业或替代现场评估。',
      input: '准备作业描述、设备或物料、能量与现场条件；请使用脱敏信息。',
      steps: '描述任务 → 生成建议初稿 → 编辑步骤 → 检查遗漏 → 人工复核与导出。',
      example: '虚构示例：点击“使用离心泵检修示例”，查看建议步骤与控制措施；示例不代表现场方案。',
      review: '逐项核实危害、控制措施、L/S评分与企业矩阵。风险分值（L×S）和矩阵阈值为工具默认值，不等于风险可接受。',
      backup: '离开或刷新前导出 Excel。当前没有项目恢复功能，Excel 不能导回本工具。',
      article: 'articles/jsa-job-safety-analysis-steps-template-guide.html'
    },
    'compliance-identification.html': {
      id: 'compliance-identification', version: '1.6', status: '免费可用 · 会员权益',
      output: '候选法规清单 / 评价与跟踪底稿', storage: '本浏览器自动保存', rights: '免费摘要及前6条；完整结果、Excel、项目文件需会员',
      purpose: '建立候选法规与符合性评价底稿；不作最终适用性或合规结论，也不是实时法规订阅服务。',
      input: '准备单一生产地址的脱敏画像、地区、行业、实际活动与许可条件；不确定项保留待确认。',
      steps: '建立画像 → 识别候选 → 补充事实 → 核对来源与证据 → 评价、跟踪和导出。',
      example: '可先下载页面上的固定示例 Excel（仅旧版格式参考），不代表你所在企业的结果或最新法规。',
      review: '核对官方来源、文号、效力、实施日期、适用范围与地方要求；候选清单不能证明企业已符合。',
      backup: '会员可导出/导入项目 JSON，跨设备继续完善。免费预览数据仅留在本浏览器；清理浏览器或更换设备会丢失。Excel 不代替项目备份。',
      article: 'tools/regulations.html'
    },
    'training-matrix.html': {
      id: 'training-matrix', version: '0.3.2', status: '免费可用',
      output: '培训矩阵 / 计划与缺口 / Excel', storage: '本浏览器自动保存选择', rights: '生成与导出均无需会员',
      purpose: '建立岗位培训需求初稿；不用于发证、确认人员资质或替代专项培训。',
      input: '准备行业、岗位与风险活动，不输入真实人员姓名、证件号码或企业机密。',
      steps: '选择行业岗位 → 确认重点条件 → 生成矩阵 → 复核要求 → 导出。',
      example: '虚构练习：制造业 + 维修岗位 + 设备检维修风险。生成后查看矩阵、培训计划与待核验清单。',
      review: '区分法规明确要求、条件适用与风险建议；复核地区、岗位风险、资格条件、频次和学时。',
      backup: '用同一浏览器继续编辑；离开前导出 Excel 留档。当前无项目导入功能，清除本地数据仅清除此工具的选择。',
      article: 'articles/ehs-training-matrix-development-guide.html'
    },
    'incident-learning.html': {
      id: 'incident-learning', version: '0.2', status: '免费可用 · 试用版',
      output: '调查底稿 / Excel / JSON / 学习卡', storage: '仅当前页，不自动保存', rights: '无需会员；本页无统计',
      purpose: '紧急处置后整理事件调查与组织学习；不自动定级、定责、确认根因或批准关闭。',
      input: '准备脱敏事实、时间线、证据引用、屏障、行动与验证记录；不上传企业或人员资料。',
      steps: '八步整理事实与证据 → 关联原因、屏障与行动 → 完整性检查 → 人工复核 → 导出与学习。',
      example: '点击“使用虚构案例”体验完整工作流。当前是可编辑的本地工具，不只是只读演示。',
      review: '调查组核实证据、因果关系和措施效果；措施已执行不等于效果已验证。',
      backup: '刷新或关闭前备份 JSON；恢复备份继续调查。Excel 和学习卡用于复核分享，不代替 JSON。反馈在新标签页打开，原调查页保留。',
      article: 'topics/incident-investigation-learning.html'
    },
    'moc-coach.html': {
      id: 'moc-coach', version: '1.0.0', status: '免费可用',
      output: '变更记录 / CSV / JSON / 打印', storage: '本浏览器保存一条记录', rights: '无需会员；本页无统计',
      purpose: '整理变更评估、投用检查和验证关闭记录，不替代工程审查或正式审批。',
      input: '准备脱敏变更范围、技术依据、风险、行动与线下授权记录。',
      steps: '筛查变更 → 评估与措施 → 投用检查 → 验证关闭 → 备份。',
      example: '使用页面的虚构示例，检查每一步的门禁提示。',
      review: '企业确认矩阵、审批权限、PSSR条件和关闭依据，工具不自动批准。',
      backup: '切换记录前备份 JSON；可恢复备份或导出 CSV、打印报告。',
      article: 'tools/risk-analysis.html'
    }
  };

  function text(tag, value, className) {
    var node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function summary(item) { return item.status + '｜' + item.output + '｜' + item.storage + '｜' + item.rights; }
  document.querySelectorAll('.task-tool-list a[href], [data-tool-summary]').forEach(function (link) {
    var page = new URL(link.href, location.href).pathname.split('/').pop();
    var item = catalog[page];
    if (!item) return;
    var parent = link.querySelector('span') || link;
    // Existing directory buttons keep their compact CTA; disclosure goes beside them.
    if (link.hasAttribute('data-tool-summary')) parent = link.parentElement.querySelector('div') || parent;
    parent.appendChild(text('small', summary(item), 'tool-status-summary'));
  });
  document.querySelectorAll('[data-tool-guide]').forEach(function (host) {
    var page = host.getAttribute('data-tool-guide');
    var item = catalog[page];
    if (!item) return;
    host.classList.add('tool-guide');
    host.appendChild(text('p', summary(item), 'tool-guide-status'));
    var details = document.createElement('details');
    details.appendChild(text('summary', '开始前：输入、步骤、示例与数据边界'));
    var list = document.createElement('dl');
    [['适用与边界', item.purpose], ['准备输入', item.input], ['完成路径', item.steps], ['示例', item.example], ['人工复核', item.review], ['保存与备份', item.backup]].forEach(function (pair) {
      list.appendChild(text('dt', pair[0])); list.appendChild(text('dd', pair[1]));
    });
    details.appendChild(list);
    details.appendChild(text('p', '手机适合查看与补充；复杂表格、完整复核与导出建议在电脑端完成。'));
    var article = text('a', '配套方法与资源 →');
    article.href = '../' + item.article;
    details.appendChild(article);
    host.appendChild(details);
    var feedback = text('a', '反馈此工具（新标签页）', 'tool-guide-feedback');
    feedback.href = '../feedback.html?tool=' + item.id + '&from=%2Ftools%2F' + page + '&entry=tool-title&toolVersion=' + item.version;
    feedback.target = '_blank'; feedback.rel = 'noopener noreferrer';
    host.appendChild(feedback);
  });
}());
