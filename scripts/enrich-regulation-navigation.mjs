import fs from 'node:fs';

const file = new URL('../data/regulations.json', import.meta.url);
const root = JSON.parse(fs.readFileSync(file, 'utf8'));

const terms = {
  中国法规: 'https://www.npc.gov.cn/c2/c30834/202011/t20201119_308796.html',
  中国标准: 'https://openstd.samr.gov.cn/bzgk/gb/',
  美国: 'https://www.copyright.gov/title17/92chap1.html',
  欧盟: 'https://eur-lex.europa.eu/content/legal-notice/legal-notice.html',
  英国: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  国际标准: 'https://www.iso.org/copyright.html'
};

const officialLinkFixes = {
  'REG-031': 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910',
  'REG-032': 'https://normlex.ilo.org/dyn/nrmlx_en/f?p=NORMLEXPUB:12100:0::NO::P12100_ILO_CODE:C155',
  'REG-038': 'https://unece.org/transport/dangerous-goods/ghs-rev10-2023',
  'REG-057': 'https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-68',
  'REG-058': 'https://www.legislation.gov.uk/uksi/2015/483/contents',
  'REG-059': 'https://www.csagroup.org/store/product/CSA%20Z462%3A24/',
  'REG-060': 'https://store.standards.org.au/product/as-nzs-iso-45001-2018',
  'REG-156': 'https://www.cdp.net/en',
  'REG-185': 'https://www.iso.org/standard/64283.html',
  'REG-188': 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-H/section-1910.119'
};

const removeIds = new Set(['REG-089', 'REG-151', 'REG-189']);

function jurisdictionFor(record) {
  const value = `${record.num || ''} ${record.cn || ''} ${record.auth || ''}`;
  if (/^REG-EU-/.test(record.id || '')) return '欧盟';
  if (/^REG-UK-/.test(record.id || '')) return '英国';
  if (/^REG-CN-/.test(record.id || '')) return '中国';
  if (/^REG-US-/.test(record.id || '')) return '美国';
  if (['中国','美国','欧盟','英国','加拿大','澳大利亚/新西兰','国际'].includes(record.c)) return record.c;
  if (/\b(?:29|40) CFR\b/i.test(value) || /OSHA|EPA/.test(value)) return '美国';
  if (/\b(?:EC\s*1907\/2006|\d{4}\/\d+\/EU)\b/i.test(value) || /欧盟|REACH|Seveso/.test(value)) return '欧盟';
  if (/COMAH|英国/.test(value)) return '英国';
  if (/CSA\s/i.test(value) || /加拿大/.test(value)) return '加拿大';
  if (/AS\/NZS|澳洲|新西兰/.test(value)) return '澳大利亚/新西兰';
  return '国际';
}

function categoryFor(record, jurisdiction) {
  const value = `${record.num || ''} ${record.cn || ''}`;
  if (['美国', '欧盟', '英国'].includes(jurisdiction)) return '国外法规';
  if (/ISO|IEC|NFPA|API|CSA|AS\/NZS|EN\sISO/i.test(value)) return '版权标准';
  if (/CCPS|IOGP|CDP|GHS/i.test(value)) return '国际指南';
  if (jurisdiction === '中国' && /标准/.test(record.type || '')) return '中国标准';
  if (jurisdiction === '中国') return '中国法规';
  return '国际指南';
}

function policyFor(category) {
  if (category === '版权标准') return 'official_purchase_or_read';
  if (category === '中国标准') return 'official_link_only';
  return 'official_link_only';
}

function termsFor(category, jurisdiction) {
  if (category === '版权标准') return terms.国际标准;
  if (category === '中国标准') return terms.中国标准;
  if (jurisdiction === '中国') return terms.中国法规;
  return terms[jurisdiction] || '';
}

const cleaned = root.regulations
  .filter(record => !removeIds.has(record.id))
  .map(record => {
    if (/^REG-EU-/.test(record.id || '')) return {...record, c:'欧盟', jurisdiction:'欧盟', type:/Regulation/.test(record.num || '')?'法规':'指令', sourceCategory:'国外法规', downloadPolicy:'official_download', licenseOrTermsUrl:terms.欧盟};
    if (/^REG-UK-/.test(record.id || '')) return {...record, c:'英国', jurisdiction:'英国', type:'法规', sourceCategory:'国外法规', downloadPolicy:'official_download', licenseOrTermsUrl:terms.英国};
    if (/^REG-CN-/.test(record.id || '')) return {...record, c:'中国', jurisdiction:'中国'};
    if (officialLinkFixes[record.id]) {
      record.link = officialLinkFixes[record.id];
      record.sourceUrl = officialLinkFixes[record.id];
      record.lastVerifiedAt = '2026-08-09';
      record.verificationStatus = '已核验';
      record.sourceName = record.id === 'REG-058' ? 'legislation.gov.uk' :
        record.id === 'REG-032' ? 'ILO NORMLEX' :
        record.id === 'REG-038' ? 'UNECE' :
        record.id === 'REG-156' ? 'CDP' :
        /REG-(031|057|188)/.test(record.id) ? 'eCFR' : record.sourceName || '官方来源';
    }
    if (record.id === 'REG-185') {
      record.num = 'ISO 45002:2023';
      record.yr = 2023;
    }
    const jurisdiction = jurisdictionFor(record);
    const sourceCategory = categoryFor(record, jurisdiction);
    record.c = jurisdiction;
    record.jurisdiction = jurisdiction;
    if (jurisdiction === '美国') record.type = '联邦法规';
    record.sourceCategory = sourceCategory;
    record.officialSourceUrl = record.sourceUrl || record.link || '';
    record.downloadPolicy = policyFor(sourceCategory);
    record.licenseOrTermsUrl = termsFor(sourceCategory, jurisdiction);
    record.reviewStatus = record.verificationStatus === '已核验' ? 'reviewed' : 'pending_review';
    return record;
  });

const usRecords = [
  ['REG-US-001','职业伤害和疾病记录与报告','Recording and Reporting Occupational Injuries and Illnesses','29 CFR Part 1904','记录报告','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1904'],
  ['REG-US-002','紧急行动计划','Emergency Action Plans','29 CFR 1910.38','应急管理','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-E/section-1910.38'],
  ['REG-US-003','职业噪声暴露','Occupational Noise Exposure','29 CFR 1910.95','职业健康','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-G/section-1910.95'],
  ['REG-US-004','易燃液体','Flammable Liquids','29 CFR 1910.106','消防防爆','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-H/section-1910.106'],
  ['REG-US-005','危险废物作业与应急响应','Hazardous Waste Operations and Emergency Response','29 CFR 1910.120','危险作业','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-H/section-1910.120'],
  ['REG-US-006','个人防护装备通用要求','General Requirements - Personal Protective Equipment','29 CFR 1910.132','PPE','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-I/section-1910.132'],
  ['REG-US-007','呼吸防护','Respiratory Protection','29 CFR 1910.134','职业健康','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-I/section-1910.134'],
  ['REG-US-008','许可进入受限空间','Permit-Required Confined Spaces','29 CFR 1910.146','受限空间','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-J/section-1910.146'],
  ['REG-US-009','危险能量控制（上锁挂牌）','The Control of Hazardous Energy (Lockout/Tagout)','29 CFR 1910.147','LOTO','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-J/section-1910.147'],
  ['REG-US-010','便携式灭火器','Portable Fire Extinguishers','29 CFR 1910.157','消防','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-L/section-1910.157'],
  ['REG-US-011','动力工业车辆','Powered Industrial Trucks','29 CFR 1910.178','特种设备','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-N/section-1910.178'],
  ['REG-US-012','机械通用防护要求','General Requirements for All Machines','29 CFR 1910.212','机械安全','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-O/section-1910.212'],
  ['REG-US-013','焊接、切割和钎焊通用要求','General Requirements - Welding, Cutting and Brazing','29 CFR 1910.252','动火作业','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-Q/section-1910.252'],
  ['REG-US-014','空气污染物','Air Contaminants','29 CFR 1910.1000','职业健康','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-Z/section-1910.1000'],
  ['REG-US-015','员工接触和医疗记录访问','Access to Employee Exposure and Medical Records','29 CFR 1910.1020','职业健康','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-Z/section-1910.1020'],
  ['REG-US-016','危险信息传递','Hazard Communication','29 CFR 1910.1200','化学品','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-Z/section-1910.1200'],
  ['REG-US-017','电气安全通用要求','Electrical - General Requirements','29 CFR Part 1910 Subpart S','电气安全','https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-S']
].map(([id, cn, en, num, cat, link]) => ({
  id, cn, en, num, auth: 'U.S. Department of Labor / OSHA', yr: '', type: '联邦法规', cat,
  c: '美国', link, jurisdiction: '美国', sourceCategory: '国外法规', officialSourceUrl: link,
  downloadPolicy: 'official_link_only', licenseOrTermsUrl: terms.美国, reviewStatus: 'reviewed',
  status: '现行（以eCFR最新文本为准）', sourceName: 'eCFR', sourceType: '官方动态文本',
  lastVerifiedAt: '2026-08-09', verificationStatus: '已核验'
}));

const euRecords = [
  ['REG-EU-001','欧盟化学品分类、标签和包装法规（CLP）','Classification, Labelling and Packaging Regulation','Regulation (EC) No 1272/2008','化学品','32008R1272'],
  ['REG-EU-002','欧盟职业安全健康框架指令','OSH Framework Directive','Directive 89/391/EEC','综合管理','31989L0391'],
  ['REG-EU-003','工作场所化学因素指令','Chemical Agents Directive','Directive 98/24/EC','职业健康','31998L0024'],
  ['REG-EU-004','致癌、致突变和生殖毒性物质指令','Carcinogens, Mutagens and Reprotoxic Substances Directive','Directive 2004/37/EC','职业健康','32004L0037'],
  ['REG-EU-005','爆炸性环境工作场所最低要求指令（ATEX 137）','ATEX Workplace Directive','Directive 1999/92/EC','防火防爆','31999L0092'],
  ['REG-EU-006','潜在爆炸性环境设备指令（ATEX 114）','ATEX Equipment Directive','Directive 2014/34/EU','防火防爆','32014L0034'],
  ['REG-EU-007','个人防护装备法规','Personal Protective Equipment Regulation','Regulation (EU) 2016/425','PPE','32016R0425'],
  ['REG-EU-008','机械指令','Machinery Directive','Directive 2006/42/EC','机械安全','32006L0042'],
  ['REG-EU-009','工业排放指令','Industrial Emissions Directive','Directive 2010/75/EU','环境管理','32010L0075'],
  ['REG-EU-010','废物框架指令','Waste Framework Directive','Directive 2008/98/EC','固体废物','32008L0098'],
  ['REG-EU-011','危险货物内陆运输指令','Inland Transport of Dangerous Goods Directive','Directive 2008/68/EC','危险品运输','32008L0068'],
  ['REG-EU-012','工作中接触石棉指令','Asbestos at Work Directive','Directive 2009/148/EC','职业健康','32009L0148'],
  ['REG-EU-013','工作中接触生物因素指令','Biological Agents Directive','Directive 2000/54/EC','职业健康','32000L0054'],
  ['REG-EU-014','工作场所个人防护装备指令','Use of Personal Protective Equipment Directive','Directive 89/656/EEC','PPE','31989L0656'],
  ['REG-EU-015','工作设备使用最低安全健康要求指令','Use of Work Equipment Directive','Directive 2009/104/EC','设备安全','32009L0104']
].map(([id, cn, en, num, cat, celex]) => {
  const link = `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`;
  return {id, cn, en, num, auth:'European Parliament / Council of the EU', yr:num.match(/\b(19|20)\d{2}\b/)?.[0] || '', type:/Regulation/.test(num)?'法规':'指令', cat, c:'欧盟', link,
    jurisdiction:'欧盟', sourceCategory:'国外法规', officialSourceUrl:link,
    officialDownloadUrl:`https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:${celex}`,
    downloadPolicy:'official_download', licenseOrTermsUrl:terms.欧盟, reviewStatus:'reviewed', status:'现行状态以EUR-Lex为准',
    sourceName:'EUR-Lex', sourceType:'官方文本', lastVerifiedAt:'2026-08-13', verificationStatus:'已核验'};
});

const ukRecords = [
  ['REG-UK-001','英国职业健康安全法','Health and Safety at Work etc. Act 1974','HSWA 1974','综合管理','ukpga/1974/37'],
  ['REG-UK-002','工作健康与安全管理条例','Management of Health and Safety at Work Regulations 1999','SI 1999/3242','风险评估','uksi/1999/3242'],
  ['REG-UK-003','有害健康物质控制条例','Control of Substances Hazardous to Health Regulations 2002','COSHH 2002','职业健康','uksi/2002/2677'],
  ['REG-UK-004','工作设备提供和使用条例','Provision and Use of Work Equipment Regulations 1998','PUWER 1998','设备安全','uksi/1998/2306'],
  ['REG-UK-005','起重作业及起重设备条例','Lifting Operations and Lifting Equipment Regulations 1998','LOLER 1998','起重安全','uksi/1998/2307'],
  ['REG-UK-006','工作场所个人防护装备条例','Personal Protective Equipment at Work Regulations 2022','SI 2022/8','PPE','uksi/2022/8'],
  ['REG-UK-007','工作场所健康、安全与福利条例','Workplace (Health, Safety and Welfare) Regulations 1992','SI 1992/3004','工作场所','uksi/1992/3004'],
  ['REG-UK-008','受限空间条例','Confined Spaces Regulations 1997','SI 1997/1713','受限空间','uksi/1997/1713'],
  ['REG-UK-009','伤害、疾病及危险事件报告条例','Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013','RIDDOR 2013','事故报告','uksi/2013/1471'],
  ['REG-UK-010','危险物质及爆炸性环境条例','Dangerous Substances and Explosive Atmospheres Regulations 2002','DSEAR 2002','防火防爆','uksi/2002/2776'],
  ['REG-UK-011','工作场所噪声控制条例','Control of Noise at Work Regulations 2005','SI 2005/1643','职业健康','uksi/2005/1643'],
  ['REG-UK-012','高处作业条例','Work at Height Regulations 2005','SI 2005/735','高处作业','uksi/2005/735'],
  ['REG-UK-013','石棉控制条例','Control of Asbestos Regulations 2012','SI 2012/632','职业健康','uksi/2012/632'],
  ['REG-UK-014','英国环境保护法','Environmental Protection Act 1990','EPA 1990','环境管理','ukpga/1990/43'],
  ['REG-UK-015','消防安全改革令','Regulatory Reform (Fire Safety) Order 2005','SI 2005/1541','消防安全','uksi/2005/1541']
].map(([id, cn, en, num, cat, path]) => {
  const link = `https://www.legislation.gov.uk/${path}/contents`;
  return {id, cn, en, num, auth:'UK Parliament', yr:num.match(/\b(19|20)\d{2}\b/)?.[0] || '', type:'法规', cat, c:'英国', link,
    jurisdiction:'英国', sourceCategory:'国外法规', officialSourceUrl:link,
    officialDownloadUrl:`https://www.legislation.gov.uk/${path}/data.pdf`, downloadPolicy:'official_download',
    licenseOrTermsUrl:terms.英国, attribution:'Contains public sector information licensed under the Open Government Licence v3.0.',
    reviewStatus:'reviewed', status:'现行状态以legislation.gov.uk为准', sourceName:'legislation.gov.uk', sourceType:'官方文本',
    lastVerifiedAt:'2026-08-13', verificationStatus:'已核验'};
});

const chinaRecords = [
  ['REG-CN-001','工贸企业重大事故隐患判定标准','应急管理部令第10号','应急管理部',2023,'重大隐患','https://www.mem.gov.cn/gk/zfxxgkpt/fdzdgknr/gz11/202305/t20230523_451578.shtml'],
  ['REG-CN-002','工贸企业有限空间作业安全规定','应急管理部令第13号','应急管理部',2023,'有限空间','https://www.mem.gov.cn/gk/zfxxgkpt/fdzdgknr/202312/t20231208_471355.shtml'],
  ['REG-CN-003','生产安全事故罚款处罚规定','应急管理部令第14号','应急管理部',2024,'事故管理','https://www.mem.gov.cn/gk/zfxxgkpt/fdzdgknr/gz11/202401/t20240116_475216.shtml'],
  ['REG-CN-004','中华人民共和国突发事件应对法（2024修订）','主席令第二十五号','全国人大常委会',2024,'应急管理','https://flk.npc.gov.cn/detail?fileId=&id=ff8081818d6a424b01905f13edba2efb'],
  ['REG-CN-005','中华人民共和国噪声污染防治法','主席令第一〇四号','全国人大常委会',2021,'噪声管理','https://www.mee.gov.cn/ywgz/fgbz/fl/202112/t20211225_965275.shtml'],
  ['REG-CN-006','危险废物转移管理办法','部令第23号','生态环境部等',2021,'危险废物','https://www.mee.gov.cn/gzk/gz/202112/t20211228_965467.shtml'],
  ['REG-CN-007','企业环境信息依法披露管理办法','部令第24号','生态环境部',2021,'环境管理','https://www.mee.gov.cn/gzk/gz/202112/t20211210_963770.shtml'],
  ['REG-CN-008','危险化学品企业重大危险源安全包保责任制办法（试行）','应急厅〔2021〕12号','应急管理部办公厅',2021,'重大危险源','https://www.mem.gov.cn/gk/zfxxgkpt/fdzdgknr/202102/t20210207_379780.shtml'],
  ['REG-CN-009','化工和危险化学品生产经营企业重大生产安全事故隐患判定准则','AQ 3067—2026','应急管理部',2026,'重大隐患','https://www.mem.gov.cn/fw/flfgbz/bz/bzwb/202603/t20260325_598035.shtml'],
  ['REG-CN-010','危险化学品重大危险源安全包保责任管理要求','AQ 3072—2026','应急管理部',2026,'重大危险源','https://www.mem.gov.cn/xw/yjglbgzdt/202603/t20260331_598672.shtml']
].map(([id, cn, num, auth, yr, cat, link]) => ({id,cn,en:'',num,auth,yr,type:/^AQ /.test(num)?'行业标准':'法规',cat,c:'中国',link,
  jurisdiction:'中国',sourceCategory:/^AQ /.test(num)?'中国标准':'中国法规',officialSourceUrl:link,downloadPolicy:'official_link_only',
  licenseOrTermsUrl:/^AQ /.test(num)?terms.中国标准:terms.中国法规,reviewStatus:'reviewed',status:yr===2026?'已发布，2026-09-30实施':'现行',
  sourceName:/mem\.gov\.cn/.test(link)?'应急管理部':'官方来源',sourceType:'官方原文',lastVerifiedAt:'2026-08-13',verificationStatus:'已核验'}));

const ids = new Set(cleaned.map(record => record.id));
for (const record of [...usRecords, ...euRecords, ...ukRecords, ...chinaRecords]) {
  if (!ids.has(record.id)) { cleaned.push(record); ids.add(record.id); }
}

root.regulations = cleaned;
root.metadata = {
  ...(root.metadata || {}),
  updatedAt: '2026-08-13',
  downloadPolicyVersion: '1.1',
  note: '法规导航仅提供官方来源和经审查的下载策略；版权标准不由本站托管。'
};

fs.writeFileSync(file, `${JSON.stringify(root, null, 2)}\n`);

const counts = cleaned.reduce((acc, record) => {
  acc[record.jurisdiction || '未分类'] = (acc[record.jurisdiction || '未分类'] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ total: cleaned.length, counts }, null, 2));
