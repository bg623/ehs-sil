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
  if (record.c === '中国') return '中国';
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

const ids = new Set(cleaned.map(record => record.id));
for (const record of usRecords) if (!ids.has(record.id)) cleaned.push(record);

root.regulations = cleaned;
root.metadata = {
  ...(root.metadata || {}),
  updatedAt: '2026-08-09',
  downloadPolicyVersion: '1.0',
  note: '法规导航仅提供官方来源和经审查的下载策略；版权标准不由本站托管。'
};

fs.writeFileSync(file, `${JSON.stringify(root, null, 2)}\n`);

const counts = cleaned.reduce((acc, record) => {
  acc[record.jurisdiction || '未分类'] = (acc[record.jurisdiction || '未分类'] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ total: cleaned.length, counts }, null, 2));
