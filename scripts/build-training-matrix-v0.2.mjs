import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'data/training-matrix/catalog-v0.2.json');
const verifiedAt = '2026-08-19';

const industries = [
  { id: 'chemical', name: '化工与危险化学品', group: '高风险行业', description: '适用于化工生产、危化品生产经营储存及危化品使用型化工企业；是否属于高危生产经营单位须另行勾选。', recommended_roles: ['principal','ehs','occupational_health_manager','environmental_manager','fire_manager','special_equipment_director','supervisor','permit_approver','process_engineer','operator','maintenance','electrician','instrument_technician','welding_worker','warehouse','hazchem_warehouse','utilities_operator','contractor_manager','contractor_worker','emergency_team','confined_space_guardian','gas_tester'] },
  { id: 'pharma', name: '制药与生物医药', group: '流程制造', description: '覆盖生产、实验室、危化品、职业健康、环保设施与公用工程；不替代GxP培训体系。', recommended_roles: ['principal','ehs','occupational_health_manager','environmental_manager','fire_manager','supervisor','process_engineer','operator','maintenance','laboratory','utilities_operator','wastewater_operator','hazardous_waste_manager','contractor_manager','contractor_worker','emergency_team'] },
  { id: 'manufacturing', name: '通用制造', group: '工贸行业', description: '覆盖机械、电气、维修、物流、有限空间、职业健康和特种设备等常见工贸场景。', recommended_roles: ['principal','ehs','occupational_health_manager','environmental_manager','fire_manager','special_equipment_director','supervisor','operator','maintenance','electrician','instrument_technician','welding_worker','high_place_worker','lifting_worker','forklift_driver','warehouse','contractor_manager','contractor_worker','emergency_team'] },
  { id: 'warehouse_logistics', name: '仓储与厂内物流', group: '工贸行业', description: '适用于普通仓库、危化品仓库、装卸、叉车和厂内交通场景；危化品经营许可要求需另行复核。', recommended_roles: ['principal','ehs','fire_manager','special_equipment_director','supervisor','forklift_driver','warehouse','hazchem_warehouse','contractor_manager','contractor_worker','emergency_team'] },
  { id: 'laboratory_rd', name: '实验室与研发', group: '研发场景', description: '适用于企业实验室、检测和研发场景，覆盖试剂、气瓶、废物、职业暴露和应急。', recommended_roles: ['principal','ehs','occupational_health_manager','environmental_manager','fire_manager','supervisor','laboratory','hazardous_waste_manager','hazardous_waste_operator','contractor_manager','contractor_worker','emergency_team','first_aider'] }
];

const roles = [
  ['principal','主要负责人/工厂负责人','管理与专业负责人','对安全生产全面负责；是否属于法定高危单位影响培训学时与考核要求。'],
  ['ehs','安全生产管理人员/EHS','管理与专业负责人','专兼职安全生产管理人员及安全管理机构人员。'],
  ['occupational_health_manager','职业卫生管理人员','管理与专业负责人','负责职业病危害防治、告知、监测和职业健康监护。'],
  ['environmental_manager','环保管理人员','管理与专业负责人','负责排污许可、台账、自行监测、固废和环境应急。'],
  ['fire_manager','消防安全责任人/管理人','管理与专业负责人','包括专兼职消防管理人员；消防控制室值班人员需另按岗位资格复核。'],
  ['special_equipment_director','特种设备安全总监/安全员','管理与专业负责人','按设备类别和使用单位规模配置并履行日管控、周排查、月调度等职责。'],
  ['supervisor','车间主任/班组长','管理与专业负责人','负责班组风险沟通、现场监督、作业条件确认和人员能力把关。'],
  ['permit_approver','特殊作业审批人/作业许可签发人','管理与专业负责人','负责动火、有限空间、高处、吊装等许可的审批与关闭。'],
  ['process_engineer','工艺/生产技术人员','管理与专业负责人','参与操作规程、工艺风险、变更、开停车和异常工况管理。'],
  ['operator','生产操作人员','生产与维修岗位','执行操作规程、巡检、异常处置和岗位应急。'],
  ['maintenance','机械维修人员','生产与维修岗位','开展设备拆装、检维修、能量隔离和试运。'],
  ['electrician','电工作业人员','生产与维修岗位','直接从事电工作业时须核对特种作业目录和操作证。'],
  ['instrument_technician','仪表/自动化人员','生产与维修岗位','涉及联锁、报警、旁路、校验和危险能量控制。'],
  ['welding_worker','焊接与热切割作业人员','生产与维修岗位','直接从事焊接热切割时须核对特种作业操作证。'],
  ['high_place_worker','高处作业人员','生产与维修岗位','从事适用高处安装、维护、拆除等作业时核对特种作业要求。'],
  ['lifting_worker','起重机械作业/指挥/司索人员','生产与维修岗位','按设备类型和实际职责核对特种设备作业人员资格。'],
  ['utilities_operator','公用工程操作人员','生产与维修岗位','涉及锅炉、压力系统、制冷、气体、污水和能源系统。'],
  ['laboratory','实验室/检测人员','仓储、实验室与环保岗位','涉及试剂、气瓶、反应、废物、设备和职业暴露。'],
  ['forklift_driver','叉车/场内专用机动车辆作业人员','仓储、实验室与环保岗位','按特种设备目录和作业项目核对资格及企业授权。'],
  ['warehouse','普通仓库与装卸人员','仓储、实验室与环保岗位','负责收发、堆垛、装卸、交通接口和异常处置。'],
  ['hazchem_warehouse','危险化学品仓储人员','仓储、实验室与环保岗位','负责危化品接收、分类、相容性、标识、储存和泄漏处置。'],
  ['wastewater_operator','废水/废气治理设施操作人员','仓储、实验室与环保岗位','负责污染防治设施运行、巡检、异常报告和记录。'],
  ['hazardous_waste_manager','危险废物管理人员','仓储、实验室与环保岗位','负责危废识别、计划、台账、标签、贮存和转移。'],
  ['hazardous_waste_operator','危险废物收集/贮存操作人员','仓储、实验室与环保岗位','执行分类收集、包装、标签、入库和泄漏处置。'],
  ['contractor_manager','承包商项目/接口管理人员','承包商与特殊状态','负责资质能力审查、协议、入场、许可接口和现场协调。'],
  ['contractor_worker','承包商现场作业人员','承包商与特殊状态','接受入场教育、风险交底和与作业相匹配的专项培训。'],
  ['newcomer','新员工/转岗/复岗/派遣/实习人员','承包商与特殊状态','用于生成岗前、三级教育及特殊身份培训要求。'],
  ['emergency_team','应急救援队员/兼职应急人员','应急与专项角色','承担抢险、堵漏、洗消、救援等预案职责。'],
  ['first_aider','急救员','应急与专项角色','承担现场急救、AED/CPR等企业指定职责。'],
  ['confined_space_guardian','有限空间监护人员','应急与专项角色','全程监护、实时联络、异常撤离并制止盲目施救。'],
  ['gas_tester','气体检测人员','应急与专项角色','承担作业前及作业中气体检测、记录和仪器核查。']
].map(([id,name,group,description]) => ({id,name,group,description}));

const riskTags = [
  ['hazchem_high_risk_unit','属于危化品生产/经营/储存等高危单位','企业法定属性','影响负责人、安全管理人员和新员工的法定培训学时。'],
  ['hazchem_use','生产或使用危险化学品','企业法定属性','不等同于自动属于高危单位；需结合许可类别和业务性质复核。'],
  ['major_hazard','构成危险化学品重大危险源','企业法定属性','触发重大危险源包保、监测监控和应急能力要求。'],
  ['regulated_process','涉及重点监管危险化工工艺/高危工艺','企业法定属性','需按实际工艺目录、装置和岗位确认。'],
  ['fire_key_unit','消防安全重点单位/人员密集场所','企业法定属性','影响消防培训和演练最低频次。'],
  ['occupational_hazards','存在职业病危害因素','企业法定属性','触发职业卫生管理、劳动者培训和健康监护。'],
  ['special_equipment','使用特种设备','企业法定属性','触发使用单位责任、管理人员和作业人员能力要求。'],
  ['pollutant_permit','纳入排污许可或排污登记管理','企业法定属性','触发按证排污、台账、自行监测和执行报告能力。'],
  ['hazardous_waste','产生、收集或贮存危险废物','企业法定属性','触发危废识别、标签、贮存、台账和转移能力。'],
  ['env_emergency','需编制/备案突发环境事件应急预案','企业法定属性','触发环境应急培训、演练和岗位职责。'],
  ['new_transfer_return','新入职、转岗、复岗或岗位内容变化','人员与变化','用于确定岗前、三级教育或重新培训。'],
  ['dispatched_intern','存在劳务派遣或实习人员','人员与变化','使用单位应纳入统一安全管理并开展相应培训。'],
  ['contractor','存在外包、承包或租赁项目','人员与变化','触发承包商资质能力、协议、入场和统一协调管理。'],
  ['change','新工艺、新技术、新材料、新设备或其他变更','人员与变化','变更投用前应对相关人员开展专门培训。'],
  ['process_operation','连续/批次化工艺生产或复杂开停车','化学品与过程安全','触发操作规程、开停车、异常工况和过程安全能力。'],
  ['chemicals','岗位接触危险化学品/有害化学品','化学品与过程安全','触发SDS、标签、危害沟通、相容性和泄漏处置。'],
  ['fire_explosion','存在火灾、爆炸或可燃气体风险','化学品与过程安全','触发防火防爆、报警、疏散和初起火灾处置。'],
  ['combustible_dust','存在可燃性粉尘风险','化学品与过程安全','触发粉尘爆炸认知、点火源控制和除尘系统安全。'],
  ['equipment_maintenance','设备检维修、拆装或试运','检维修与特殊作业','触发检维修准备、隔离、交付、试运和恢复。'],
  ['loto','存在危险能量隔离','检维修与特殊作业','区分授权人员、受影响人员和其他相关人员。'],
  ['hot_work','动火、焊接或热切割作业','检维修与特殊作业','触发作业人员、监护、检测和审批角色能力。'],
  ['confined_space','有限空间/受限空间作业','检维修与特殊作业','触发进入、监护、审批、检测和救援角色能力。'],
  ['work_at_height','高处作业或坠落风险','检维修与特殊作业','触发高处作业、防坠落、救援和资格复核。'],
  ['temporary_power','临时用电','检维修与特殊作业','触发电气作业、使用检查和许可接口能力。'],
  ['electrical_work','电气安装、维修、试验或带电相关作业','检维修与特殊作业','触发特种作业资格及电气安全能力。'],
  ['lifting','吊装或起重机械作业','检维修与特殊作业','触发吊装策划、指挥、司索、司机和警戒职责。'],
  ['excavation','动土/挖掘作业','检维修与特殊作业','触发地下设施确认、支护、出入和许可管理。'],
  ['road_breaking','断路/占道作业','检维修与特殊作业','触发交通组织、隔离、标志和应急通道管理。'],
  ['blind_flange','盲板抽堵/工艺隔离作业','检维修与特殊作业','触发介质确认、挂牌、顺序和防护能力。'],
  ['vehicles','叉车、装卸车辆或厂内交通','设备、交通与人机风险','触发持证、企业授权、日检和人车分流。'],
  ['pressure_system','锅炉、压力容器、压力管道或气瓶','设备、交通与人机风险','触发特种设备管理、作业资格和专项应急。'],
  ['ppe','需使用个体防护装备','职业健康与个人防护','触发选用、佩戴、适合性、维护和报废。'],
  ['respiratory_protection','需使用呼吸防护用品','职业健康与个人防护','触发适合性、密合性、限制和应急边界。'],
  ['noise','噪声暴露或听力防护','职业健康与个人防护','触发危害告知、听力保护和健康监护。'],
  ['manual_handling','人工搬运、重复动作或不良姿势','职业健康与个人防护','用于人体工效和肌肉骨骼风险控制。'],
  ['emergency','承担一般应急、疏散或现场处置职责','消防、应急与环保','触发预案、报警、疏散和现场处置能力。'],
  ['spill_response','化学品泄漏/环境污染先期处置','消防、应急与环保','触发围堵、收集、报告、PPE和废物处置边界。'],
  ['waste_gas_water_facility','运行废水、废气或其他污染防治设施','消防、应急与环保','触发设施运行、异常报告、台账和监测能力。'],
  ['lab_risk','实验室试剂、气瓶、反应或生物/物理风险','实验室与研发','触发实验室专项风险与废物管理。']
].map(([id,name,group,description]) => ({id,name,group,description}));

const sources = [
  ['safe_production_law','中华人民共和国安全生产法',null,'第二十一、二十五、二十八至三十、四十四至四十五、四十八至四十九条','法律','应急管理部','https://www.mem.gov.cn/fw/flfgbz/fg/202107/t20210716_416558.shtml','2021-09-01','effective','安全培训、四新、特种作业、危害告知、PPE和承包协同。'],
  ['training_order_3','生产经营单位安全培训规定','原国家安全监管总局令第3号（经第63、80号令修正）','第三至四、六至十、十一至二十二条','部门规章','应急管理部','https://www.mem.gov.cn/gk/gwgg/agwzlfl/zjl_01/201505/t20150529_233772.shtml','2006-03-01','effective','规定负责人、安全管理人员、新员工培训内容、学时、再培训和档案。'],
  ['training_measures_44','安全生产培训管理办法','原国家安全监管总局令第44号（经第63、80号令修正）','相关条款','部门规章','应急管理部','https://www.mem.gov.cn/gk/gwgg/agwzlfl/zjl_01/201505/t20150529_233776.shtml','2012-03-01','effective','培训组织、考核与培训条件管理；具体适用由企业复核。'],
  ['special_work_19','特种作业人员安全技术培训考核管理规定','应急管理部令第19号','全文及现行特种作业目录','部门规章','应急管理部','https://www.mem.gov.cn/gk/zfxxgkpt/fdzdgknr/202512/t20251219_589179.shtml','2026-06-01','effective','2026版取代原第30号令；证书、换证和具体作业项目须按目录核对。'],
  ['hazchem_reg_591','危险化学品安全管理条例','国务院令第591号（2013年修正）','第四条等','行政法规','国务院','https://www.mee.gov.cn/ywgz/fgbz/xzfg/202001/t20200109_758414.shtml','2011-12-01','effective','危化品单位应开展安全教育、法制教育和岗位技术培训，考核合格后上岗。'],
  ['confined_space_13','工贸企业有限空间作业安全规定','应急管理部令第13号','第四、九等条','部门规章','应急管理部','https://www.mem.gov.cn/gk/zfxxgkpt/fdzdgknr/202312/t20231208_471355.shtml','2024-01-01','effective','适用于工贸企业，明确审批、监护、作业、安全培训和应急职责。'],
  ['emergency_reg_708','生产安全事故应急条例','国务院令第708号','第十、十一、十五条等','行政法规','国务院','https://www.mem.gov.cn/fw/flfgbz/201903/t20190301_231790.shtml','2019-04-01','effective','从业人员应急教育、应急救援人员培训合格和定期训练。'],
  ['emergency_plan_88','生产安全事故应急预案管理办法','原国家安全监管总局令第88号（应急管理部令第2号修正）','第三十一至三十三条等','部门规章','应急管理部','https://www.mem.gov.cn/gk/zfxxgkpt/fdzdgknr/gz11/201606/t20160603_405633.shtml','2016-07-01','effective','预案宣传教育、培训、演练、评估和修订。'],
  ['fire_law','中华人民共和国消防法',null,'第十六、四十四条等','法律','全国人大常委会','https://www.beijing.gov.cn/zhengce/zhengcefagui/qtwj/202307/t20230726_3207767.html','2021-04-29','effective','2021年修正版全文；单位消防职责、消防宣传教育、灭火疏散和报警处置。'],
  ['fire_order_61','机关、团体、企业、事业单位消防安全管理规定','公安部令第61号','第三十六至四十条','部门规章','国家消防救援局','https://www.119.gov.cn/gk/flfg/bmgz/2022/29134.shtml','2002-05-01','effective','重点单位员工至少每年一次消防培训；公众聚集场所至少每半年一次；明确专门培训和演练。'],
  ['occupational_disease_law','中华人民共和国职业病防治法',null,'第三十四至三十六条等','法律','全国人大常委会','https://policy.mofcom.gov.cn/claw/clawInfo.shtml?id=66127','2018-12-29','effective','2018年修正版；主要负责人、职业卫生管理人员及劳动者的职业卫生培训、告知和防护。'],
  ['workplace_oh_5','工作场所职业卫生管理规定','国家卫生健康委员会令第5号','第九、十、三十四条等','部门规章','国家卫生健康委员会','https://www.nhc.gov.cn/wjw/c100221/202201/edc9ae24435d4d93ace796f33c29b029.shtml','2021-02-01','effective','职业卫生负责人、管理人员和劳动者培训，危害严重岗位专门培训。'],
  ['gbz188_2025','职业健康监护技术规范','GBZ 188—2025','全文','强制性职业卫生标准','国家卫生健康委员会','https://www.nhc.gov.cn/fzs/c100048/202509/93c5090f626f471b98dac5088824fc8a.shtml','2026-08-01','effective','已代替GBZ 188—2014，用于确定接害人员职业健康监护要求。'],
  ['gb39800_1','个体防护装备配备规范 第1部分：总则','GB 39800.1—2020','全文','强制性国家标准','国家市场监督管理总局/国家标准化管理委员会','https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=B8071B9B0A429EB6067597A7C98629C9','2022-01-01','effective','PPE危害评估、配备、使用、维护、培训和记录的通用要求。'],
  ['special_equipment_law','中华人民共和国特种设备安全法',null,'第十三至十四、三十四条等','法律','全国人大常委会','https://www.nea.gov.cn/2017-11/02/c_136722881.htm','2014-01-01','effective','法律全文；特种设备安全教育、技能培训及管理/检测/作业人员资格。'],
  ['special_equipment_order_74','特种设备使用单位落实使用安全主体责任监督管理规定','市场监管总局令第74号','全文','部门规章','国家市场监督管理总局','https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202307/t20230726_483493.html','2023-05-05','effective','主要负责人、安全总监、安全员职责及安全教育和技术培训。'],
  ['tsg08_2026','特种设备使用管理规则','TSG 08—2026','第2章等','安全技术规范','国家市场监督管理总局','https://zwfw.samr.gov.cn/scjg/wyk/gsgg/','2026-05-01','effective','2026版已代替TSG 08—2017；按设备类型落实使用管理和人员配置。'],
  ['gb30871_2022','危险化学品企业特殊作业安全规范','GB 30871—2022','全文','强制性国家标准','国家市场监督管理总局/国家标准化管理委员会','https://std.samr.gov.cn/gb/search/gbDetailed?id=DAB6B92C0762FC96E05397BE0A0A5F84','2022-10-01','effective','危险化学品企业动火、受限空间、盲板抽堵、高处、吊装、临时用电、动土、断路作业。'],
  ['gb46768_2025','有限空间作业安全技术规范','GB 46768—2025','全文','强制性国家标准','国家市场监督管理总局/国家标准化管理委员会','https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=C26BA1B610497F860D280ACF929D3F7D','2026-05-01','effective','全国通用有限空间安全管理及作业前、中、后技术要求。'],
  ['gb3608_2025','高处作业分级','GB 3608—2025','全文','强制性国家标准','国家市场监督管理总局/国家标准化管理委员会','https://std.samr.gov.cn/gb/search/gbDetailed?id=40C4523A3FB01115E06397BE0A0AE2D3','2026-05-01','effective','已代替GB/T 3608—2008，用于高处作业分级。'],
  ['gb9448_2025','焊接与切割安全','GB 9448—2025','全文','强制性国家标准','国家市场监督管理总局/国家标准化管理委员会','https://std.samr.gov.cn/gb/search/gbDetailed?id=9a9yrFuO0PA%3D&mode=p','2026-08-01','effective','已代替GB 9448—1999，覆盖焊接切割人员、设备、通风、防火与PPE。'],
  ['gb2894_2025','安全色和安全标志','GB 2894—2025','全文','强制性国家标准','国家市场监督管理总局/国家标准化管理委员会','https://std.samr.gov.cn/gb/search/gbDetailedCNF?id=36A29D07E2AED444E06397BE0A0ACC4C','2026-03-01','effective','已代替GB 2893—2008、GB 7231—2003和GB 2894—2008。'],
  ['gb45673_2025','危险化学品企业安全生产标准化通用规范','GB 45673—2025','教育培训及相关要素','强制性国家标准','国家市场监督管理总局/国家标准化管理委员会','https://std.samr.gov.cn/search/stdPage?q=%E5%8D%B1%E9%99%A9%E5%8C%96%E5%AD%A6%E5%93%81%E4%BC%81%E4%B8%9A%E5%AE%89%E5%85%A8%E7%94%9F%E4%BA%A7%E6%A0%87%E5%87%86%E5%8C%96%E9%80%9A%E7%94%A8%E8%A7%84%E8%8C%83&tid=','2025-11-01','effective','适用于危化品生产、使用危化品从事生产的化工企业和储存危化品经营企业。'],
  ['aqt3034_2022','化工过程安全管理导则','AQ/T 3034—2022','培训和绩效保证等20个要素','推荐性行业标准','应急管理部','https://www.mem.gov.cn/gk/zfxxgkpt/fdzdgknr/202212/t20221213_433289.shtml','2023-04-01','effective','融合国际过程安全最佳实践，用于化工过程安全能力建设。'],
  ['solid_waste_law','中华人民共和国固体废物污染环境防治法',null,'第三十六、七十七至八十二条等','法律','全国人大常委会','https://www.mee.gov.cn/ywgz/fgbz/fl/202004/t20200430_777580.shtml','2020-09-01','effective','工业固废和危险废物全过程环境管理、台账、标识、贮存和委托核实。'],
  ['gb18597_2023','危险废物贮存污染控制标准','GB 18597—2023','全文','强制性国家标准','生态环境部/国家市场监督管理总局','https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/gthw/gtfwwrkzbz/202302/t20230224_1017500.shtml','2023-07-01','effective','危险废物贮存设施、包装、过程控制、监测和环境应急。'],
  ['hj1276_2022','危险废物识别标志设置技术规范','HJ 1276—2022','全文','国家生态环境标准','生态环境部','https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/gthw/wxfwjbffbz/202302/t20230224_1017486.shtml','2023-07-01','effective','危险废物标签及贮存、利用、处置设施标志。'],
  ['pollutant_permit_reg','排污许可管理条例','国务院令第736号','第十九至二十六条等','行政法规','国务院','https://www.mee.gov.cn/zcwj/gwywj/202101/t20210129_819519.shtml','2021-03-01','effective','按证排污、污染防治设施、自行监测、台账和执行报告。'],
  ['pollutant_permit_measures','排污许可管理办法','生态环境部令第32号','第二章至第四章','部门规章','生态环境部','https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202412/t20241224_511769.html','2024-07-01','effective','细化排污单位环境管理制度、许可申请变更、自行监测和信息公开。'],
  ['environment_emergency_34','突发环境事件应急管理办法','环境保护部令第34号','第十三至十五条等','部门规章','生态环境部','https://www.mee.gov.cn/gkml/hbb/bl/201504/t20150429_299852.htm','2015-06-05','effective','环境风险、预案、应急演练、信息报告和处置。'],
  ['environment_plan_filing','企业事业单位突发环境事件应急预案备案管理办法（试行）','环发〔2015〕4号','第十、十一条等','规范性文件','生态环境部','https://www.mee.gov.cn/hdjl/yjzj/wqzj_1/201411/W020141125638160467802.pdf','2015-01-08','effective','适用单位应开展环境应急预案培训、宣传和必要演练。'],
  ['aq3026_2026','化工企业设备检修作业安全规范','AQ 3026—2026','全文','强制性行业标准','应急管理部','https://www.mem.gov.cn/fw/flfgbz/bz/bzwb/202603/t20260325_598037.shtml','2026-09-30','upcoming','截至核验日尚未实施；用于提前准备，不作为当前已生效结论。'],
  ['aq3067_2026','化工和危险化学品生产经营企业重大生产安全事故隐患判定准则','AQ 3067—2026','重点人员、生产运行和作业安全等','强制性行业标准','应急管理部','https://www.mem.gov.cn/fw/flfgbz/bz/bzwb/202603/t20260325_598035.shtml','2026-09-30','upcoming','截至核验日尚未实施；用于培训差距预评估。'],
  ['aq3072_2026','危险化学品重大危险源安全包保责任管理要求','AQ 3072—2026','全文','强制性行业标准','应急管理部','https://www.mem.gov.cn/gk/zfxxgkpt/fdzdgknr/202603/t20260325_598032.shtml','2026-09-30','upcoming','截至核验日尚未实施；涉及主要、技术和操作负责人。'],
  ['iso45001_2018','ISO 45001:2018 职业健康安全管理体系',null,'7.2能力、7.3意识及相关条款','国际最佳实践','ISO','https://www.iso.org/standard/63787.html','2018-03-12','best_practice','强调基于风险与职责确定能力、采取行动并评价有效性；非中国法定要求。'],
  ['iso14001_2026','ISO 14001:2026 环境管理体系',null,'能力、意识及运行控制相关条款','国际最佳实践','ISO','https://www.iso.org/standards/popular/iso-14000-family',null,'best_practice','已替代ISO 14001:2015；用于环境岗位能力和意识管理，非中国法定要求。'],
  ['osha_loto','OSHA 29 CFR 1910.147 危险能量控制',null,'1910.147(c)(7)','国际最佳实践','US OSHA','https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.147',null,'best_practice','区分authorized、affected和other employees并规定再培训触发；仅作方法参考。'],
  ['osha_confined','OSHA 29 CFR 1910.146 许可进入有限空间',null,'1910.146(g)、(h)至(k)','国际最佳实践','US OSHA','https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.146',null,'best_practice','按进入者、监护、主管和救援角色开展能力训练；仅作方法参考。'],
  ['osha_hazcom','OSHA 29 CFR 1910.1200 危害沟通',null,'1910.1200(h)','国际最佳实践','US OSHA','https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200',null,'best_practice','首次分配及引入新化学危害时培训标签、SDS和防护；仅作方法参考。'],
  ['osha_psm','OSHA 29 CFR 1910.119 过程安全管理',null,'1910.119(g)','国际最佳实践','US OSHA','https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.119',null,'best_practice','操作人员初训、至少每三年复训及理解验证；仅作方法参考。'],
  ['ccps_tpa','CCPS Training and Performance Assurance',null,'培训与绩效保证要素','国际最佳实践','AIChE/CCPS','https://ccps.aiche.org/introduction-training-and-performance-assurance',null,'best_practice','从“完成培训”升级为持续验证人员是否达到岗位绩效标准。'],
  ['hse_competence','HSE Training and Competence Guidance',null,'培训、监督与能力','国际最佳实践','UK HSE','https://www.hse.gov.uk/work-equipment-machinery/training-competence.htm',null,'best_practice','将知识、技能、经验、监督和适任性结合，不以签到代替胜任。'],
  ['risk_review','岗位风险评估、设备说明书与企业内部制度',null,null,'企业依据','企业内部复核','https://www.mem.gov.cn/',null,'needs_review','只能支持风险控制或最佳实践建议，不单独支持法规明确结论。']
].map(([source_id,title,document_number,article,source_type,authority,official_url,effective_date,status,verification_note]) => ({source_id,title,document_number,article,source_type,authority,official_url,effective_date,status,verified_at:verifiedAt,verification_note}));

const T = (topic_id,title_zh,category,description,delivery_methods=['专题培训'],assessment_methods=['知识测试'],evidence_examples=['培训记录','考核记录'],competence_level='knowledge') => ({topic_id,title_zh,category,description,delivery_methods,assessment_methods,evidence_examples,competence_level,active:true});
const topics = [
  T('principal_safety','主要负责人安全生产法定职责','管理与治理','掌握法定职责、全员责任制、风险与隐患、培训计划和应急领导。',['法规培训','案例研讨'],['闭卷/开卷考试','履职方案评审'],['培训合格证明','年度履职计划'],'management'),
  T('safety_manager','安全生产管理人员法定能力','管理与治理','掌握法规、风险管理、职业卫生、应急、事故报告和现场监督。',['法规培训','案例研讨'],['考试','现场问题分析'],['培训/考核证明','能力评价'],'management'),
  T('oh_manager','职业卫生管理人员能力','管理与治理','掌握危害申报、告知、检测、健康监护、防护设施和档案。',['法规培训','专题培训'],['考试','台账审核'],['培训记录','能力评价'],'management'),
  T('environment_manager','企业环境合规岗位能力','管理与治理','掌握排污许可、监测、台账、固废、环境应急和异常报告。',['法规培训','案例研讨'],['案例考核','台账抽查'],['培训记录','能力评价'],'management'),
  T('fire_manager','消防安全责任人/管理人能力','管理与治理','掌握消防职责、制度、检查、隐患、培训、演练和档案。',['专门培训','案例研讨'],['考试','现场履职评价'],['专门培训记录','履职记录'],'management'),
  T('special_equipment_governance','特种设备安全总监/安全员履职','管理与治理','掌握使用单位责任、风险管控、隐患排查、档案和应急。',['法规培训','设备专题'],['考试','履职清单评审'],['培训记录','任命及履职记录'],'management'),
  T('supervisor_control','班组风险沟通与现场监督','管理与治理','开展班前会、任务风险确认、人员能力把关、停止作业和现场纠偏。',['案例研讨','现场演练'],['现场观察','情景考核'],['授权记录','现场观察记录'],'practical'),
  T('training_governance','培训需求、计划、档案与效果评价','管理与治理','建立岗位培训需求、年度计划、记录、考核和效果复核闭环。',['工作坊','案例研讨'],['矩阵评审','档案抽查'],['培训矩阵','年度计划','效果评价'],'management'),
  T('induction_general','一般生产经营单位岗前安全培训','基础与入职','覆盖厂级、车间级、班组级培训及岗位操作和应急能力。',['三级安全教育','岗位带教'],['考试','实操考核'],['三级教育卡','试卷','实操评价'],'practical'),
  T('induction_high_risk','高危生产经营单位新员工岗前与再培训','基础与入职','针对危化等高危单位的新上岗从业人员，满足更高学时与再培训要求。',['三级安全教育','岗位带教','实操训练'],['考试','实操考核'],['学时记录','三级教育卡','考核记录'],'practical'),
  T('job_sop','岗位操作规程与异常处置','基础与入职','掌握正常、异常、紧急、开停车和禁止事项。',['岗位培训','现场带教'],['实操观察','口述推演'],['岗位授权','实操评价'],'practical'),
  T('change_training','变更投用前培训','基础与入职','在新工艺、新技术、新材料、新设备或程序变化投用前掌握新风险和控制。',['变更交底','现场演示'],['理解确认','实操验证'],['MOC培训记录','授权更新'],'practical'),
  T('dispatched_intern','劳务派遣与实习人员安全培训','基础与入职','纳入使用单位统一管理，完成岗位规程、技能、PPE和应急培训。',['岗前培训','岗位带教'],['考试','实操确认'],['培训记录','接收确认'],'practical'),
  T('contractor_management','承包商资质、能力与接口管理','承包商管理','开展能力审查、职责协议、危害沟通、许可接口、监督和绩效评价。',['管理培训','案例研讨'],['案例考核','承包商方案评审'],['审查表','协议','评价记录'],'management'),
  T('contractor_induction','承包商入场、风险交底与现场规则','承包商管理','了解现场禁令、风险、许可、隔离、报警、疏散和报告要求。',['入场培训','作业前交底'],['理解确认','现场抽问'],['入场记录','交底记录'],'awareness'),
  T('permit_to_work','特殊作业许可与现场确认','特殊作业','掌握许可申请、审批、检测、隔离、监护、变更、暂停和关闭。',['标准培训','案例评审'],['许可票评审','情景考核'],['授权记录','考核记录'],'authorized'),
  T('jsa_lmra','JSA/作业前最后一分钟风险确认','风险管理','把作业步骤、危害、控制、变化与停止作业条件转化为现场共同认知。',['工作坊','现场演练'],['JSA评审','现场观察'],['分析表','观察记录'],'practical'),
  T('incident_reporting','事件、未遂与异常报告','学习与改进','及时报告事件、未遂、异常和控制失效，保护现场并启动学习。',['微课','案例学习'],['情景问答'],['培训记录','案例复盘'],'awareness'),
  T('competence_assurance','岗位胜任力与培训有效性验证','学习与改进','以知识、技能、经验和现场表现验证胜任，识别再培训需要。',['主管工作坊','现场辅导'],['现场绩效观察','能力面谈'],['能力评价','再培训记录'],'management'),
  T('chemical_hazards','危险化学品危害与安全操作','化学品与过程安全','理解理化危害、反应性、相容性、暴露途径、储运和异常处置。',['专题培训','案例学习'],['考试','情景考核'],['培训记录','岗位考核'],'knowledge'),
  T('sds_ghs','SDS、标签与GHS危害沟通','化学品与过程安全','会查SDS、读标签、识别象形图和采取岗位控制。',['现场演示','微课'],['SDS查找实操','情景问答'],['实操评价','培训记录'],'practical'),
  T('process_safety','过程安全基础与重大事故预防','化学品与过程安全','理解物料危害、失控场景、屏障、报警联锁、泄漏和重大事故风险。',['案例研讨','专题培训'],['案例分析','口头答辩'],['考核记录','案例作业'],'knowledge'),
  T('operating_procedures','化工操作规程、开停车与异常工况','化学品与过程安全','掌握关键操作窗口、偏差响应、紧急停车和交接班。',['岗位带教','模拟推演'],['实操/模拟考核'],['岗位授权','模拟记录'],'practical'),
  T('moc_pssr','MOC、PSSR与变更后能力确认','化学品与过程安全','识别技术、设备、物料、程序和组织变更，完成投用前确认。',['案例工作坊'],['MOC案例评审'],['评审记录','培训完成证明'],'management'),
  T('major_hazard','危险化学品重大危险源与包保责任','化学品与过程安全','掌握重大危险源风险、监测报警、包保职责、检查和应急。',['法规培训','现场教学'],['履职考核','现场抽问'],['包保履职记录','培训记录'],'management'),
  T('regulated_process','重点监管危险化工工艺专项能力','化学品与过程安全','围绕具体工艺危险特性、控制参数、联锁、异常和应急进行岗位能力确认。',['工艺专项培训','模拟训练'],['工艺考试','模拟考核'],['专项考核','岗位授权'],'authorized'),
  T('alarm_interlock_override','报警、联锁与安全装置旁路管理','化学品与过程安全','理解报警响应、联锁功能、旁路审批、补偿措施和恢复验证。',['案例研讨','模拟推演'],['情景考核','旁路单评审'],['授权记录','演练记录'],'authorized'),
  T('maintenance_safety','检维修准备、交付、试运与恢复','检维修与特殊作业','覆盖工作范围、清洗置换、隔离、交付、开盖、试运和复位。',['检维修专项培训','现场演练'],['方案评审','实操观察'],['培训记录','检维修授权'],'practical'),
  T('loto_authorized','LOTO授权人员能量隔离','检维修与特殊作业','识别全部能源、隔离、上锁挂牌、验证零能量、交接和复位。',['专项培训','实操训练'],['逐项实操考核'],['LOTO授权证','实操评价'],'authorized'),
  T('loto_affected','LOTO受影响/相关人员认知','检维修与特殊作业','理解隔离目的、禁启要求、边界和沟通，不擅自操作或拆锁。',['班组培训','现场沟通'],['现场抽问'],['培训记录'],'awareness'),
  T('hot_work_performer','动火/焊接作业人员专项能力','检维修与特殊作业','掌握资格边界、设备检查、火花熔渣、气瓶、通风、PPE和防火。',['专项培训','实操训练'],['实操考核'],['操作证核验','实操记录'],'certified'),
  T('hot_work_control','动火审批、监护与气体检测','检维修与特殊作业','掌握分级、分析、隔离、清除可燃物、连续监护和完工复查。',['标准培训','情景演练'],['许可票评审','现场观察'],['授权记录','考核记录'],'authorized'),
  T('confined_entry','有限空间进入作业人员能力','检维修与特殊作业','掌握危害、进入条件、通风检测、PPE、通信、撤离和禁止盲目施救。',['专项培训','实操演练'],['情景/实操考核'],['培训记录','进入授权'],'authorized'),
  T('confined_guardian','有限空间监护人员能力','检维修与特殊作业','全程监护、保持联络、记录、识别异常、组织撤离并禁止离岗和盲目施救。',['专项培训','情景演练'],['监护实操考核'],['监护授权','考核记录'],'authorized'),
  T('confined_approver','有限空间审批与进入主管能力','检维修与特殊作业','复核辨识、隔离、检测、通风、救援、人员能力和许可关闭。',['标准培训','案例评审'],['许可票评审'],['审批授权','考核记录'],'authorized'),
  T('gas_testing','作业气体检测与仪器使用','检维修与特殊作业','掌握仪器检查、采样位置、顺序、频次、记录、报警和异常判定。',['仪器实操','现场训练'],['实操考核'],['检测授权','仪器实操记录'],'authorized'),
  T('confined_rescue','有限空间应急救援','检维修与特殊作业','优先非进入救援，掌握报警、救援装备、呼吸防护和团队协同。',['专项演练','实操训练'],['救援演练评价'],['演练记录','能力确认'],'rescue'),
  T('electrical_special','电工作业安全与特种作业资格','检维修与特殊作业','掌握电气危险、停送电、验电接地、防护和适用操作证要求。',['法定专项培训','实操训练'],['理论与实操考试'],['操作证','企业授权'],'certified'),
  T('temporary_power','临时用电设计、安装与使用检查','检维修与特殊作业','掌握配电、保护、接地、线路、潮湿/防爆环境和日常检查。',['标准培训','现场演示'],['实操检查','方案评审'],['授权记录','检查记录'],'authorized'),
  T('work_at_height','高处作业与坠落防护','检维修与特殊作业','掌握分级、作业条件、平台梯具、锚点、系挂、坠落净空和救援。',['专项培训','实操训练'],['实操考核'],['操作证/授权','实操记录'],'certified'),
  T('lifting_operator','起重机械司机、指挥与司索能力','检维修与特殊作业','掌握资格、信号、索具、载荷、禁区、试吊和异常停止。',['专项培训','实操训练'],['实操考核'],['资格核验','企业授权'],'certified'),
  T('lifting_control','吊装策划、审批与现场监督','检维修与特殊作业','掌握吊装方案、能力匹配、地基、吊点、天气、警戒和多方协调。',['案例培训','方案评审'],['吊装方案考核'],['审批授权','评审记录'],'authorized'),
  T('excavation','动土/挖掘作业安全','检维修与特殊作业','掌握地下设施确认、支护、边坡、出入、堆土、检测和恢复。',['专项培训','现场交底'],['许可票评审','现场观察'],['培训/交底记录'],'practical'),
  T('road_breaking','断路/占道与交通组织','检维修与特殊作业','掌握绕行、围挡、照明、标志、应急通道和恢复。',['专项培训','现场交底'],['方案评审'],['培训记录','现场检查记录'],'practical'),
  T('blind_flange','盲板抽堵与正隔离','检维修与特殊作业','掌握介质、压力、温度、盲板图、顺序、挂牌、PPE和泄漏防控。',['专项培训','现场演示'],['实操/票证考核'],['授权记录','作业记录'],'authorized'),
  T('forklift','叉车与场内专用机动车辆作业','特种设备与交通','掌握持证、日检、稳定性、载荷、视线、装卸、行人和停车。',['法定专项培训','驾驶实操'],['理论与实操考试'],['资格证','企业授权','日检记录'],'certified'),
  T('traffic_safety','厂内交通、人车分流与装卸接口','特种设备与交通','理解路线、限速、交叉口、倒车、装卸平台、访客车辆和行人规则。',['现场培训','路线踏勘'],['现场观察'],['培训记录','授权记录'],'practical'),
  T('special_equipment_operator','特种设备作业人员资格与操作','特种设备与交通','按设备和作业项目掌握操作规程、检查、异常和法定资格。',['法定培训','设备实操'],['理论与实操考试'],['资格证','企业授权'],'certified'),
  T('pressure_system','锅炉、压力容器/管道和气瓶安全','特种设备与交通','掌握使用边界、仪表附件、巡检、超压泄漏、气瓶和应急。',['设备专项培训','现场演示'],['实操观察','情景考核'],['培训记录','岗位授权'],'practical'),
  T('warehouse_safety','仓储、堆垛与装卸安全','仓储与实验室','掌握分区、相容性、堆垛、货架、装卸、交通和泄漏处置。',['岗位培训','现场演示'],['现场观察'],['岗位考核记录'],'practical'),
  T('lab_safety','实验室试剂、设备、气瓶与反应安全','仓储与实验室','掌握小试反应、试剂、通风橱、气瓶、锐器、废物和应急。',['专题培训','现场演示'],['实操观察','情景考核'],['培训记录','实验授权'],'practical'),
  T('occupational_health_worker','劳动者职业病危害与防护','职业健康','理解岗位危害、健康影响、控制措施、告知、PPE和报告权利义务。',['上岗前培训','定期培训'],['知识测试','现场观察'],['培训记录','告知记录'],'knowledge'),
  T('health_surveillance','职业健康监护与体检配合','职业健康','了解岗前、在岗、离岗健康检查及结果告知、复查和禁忌证管理。',['专题培训','管理说明'],['流程问答'],['告知记录','培训记录'],'awareness'),
  T('ppe','PPE选择、佩戴、检查与报废','职业健康','根据危害正确选择、佩戴、检查、维护、更换和处置PPE。',['现场演示','实操训练'],['穿戴实操考核'],['培训记录','适合性/实操评价'],'practical'),
  T('respiratory_protection','呼吸防护选择、密合与使用限制','职业健康','掌握过滤与供气边界、密合检查、滤盒更换、清洁和紧急撤离。',['专项培训','密合性训练'],['佩戴实操','适合性测试'],['培训记录','适合性记录'],'authorized'),
  T('hearing_conservation','噪声危害与听力保护','职业健康','理解噪声风险、工程控制、听力防护用品、健康监护和异常报告。',['专题培训','现场演示'],['知识测试','佩戴观察'],['培训记录','健康监护记录'],'knowledge'),
  T('ergonomics','人工搬运与人体工效','职业健康','识别负荷、姿势、频次和助力需求，采用团队搬运及改进措施。',['动作示范','现场辅导'],['现场观察'],['培训记录','改善记录'],'practical'),
  T('fire_all','全员消防、报警、疏散与初起火灾处置','消防与应急','掌握岗位火灾风险、报警、灭火器材、疏散、自救和禁止事项。',['消防培训','疏散演练'],['实操/情景考核'],['培训记录','演练记录'],'practical'),
  T('fire_key_roles','消防重点岗位专门培训','消防与应急','消防责任人、管理人、专兼职人员掌握制度、检查、设施、隐患和预案。',['专门培训','现场教学'],['考试','履职评价'],['专门培训记录','履职记录'],'management'),
  T('emergency_general','岗位应急、报警与疏散','消防与应急','熟悉预案、报警、撤离、集合、初期处置和信息报告。',['预案培训','演练'],['情景考核'],['培训记录','演练评价'],'practical'),
  T('emergency_team','应急救援队专业能力','消防与应急','按角色掌握侦检、堵漏、洗消、救援、通信和个人防护。',['专项训练','实战演练'],['实战评价'],['训练记录','能力评价'],'rescue'),
  T('first_aid','现场急救、CPR与AED','消防与应急','掌握现场安全、呼救、止血、心肺复苏、AED和转运边界。',['认证/专项培训','实操训练'],['实操考核'],['培训证书','实操记录'],'rescue'),
  T('spill_response','化学品泄漏与先期控制','消防与应急','掌握识别、报警、隔离、围堵、收集、PPE、废物处置和升级条件。',['情景培训','演练'],['情景/实操考核'],['演练记录','培训记录'],'practical'),
  T('environmental_emergency','突发环境事件预案与岗位处置','环境管理','掌握环境风险、预警、报告、截流、应急池、监测、物资和信息接口。',['预案培训','桌面/实战演练'],['情景考核','演练评价'],['培训记录','演练报告'],'practical'),
  T('environmental_awareness','全员环境因素与合规意识','环境管理','了解岗位环境因素、异常排放、节约资源、废物分类和报告要求。',['微课','班组沟通'],['情景问答'],['培训记录'],'awareness'),
  T('pollutant_permit','排污许可、台账、自行监测与执行报告','环境管理','按证运行污染防治设施，准确记录、监测、报告和公开信息。',['法规培训','系统实操'],['台账/报告考核'],['培训记录','实操评价'],'management'),
  T('pollution_facility','废水/废气治理设施运行与异常报告','环境管理','掌握操作参数、巡检、药剂、联锁、旁路禁限、异常和记录。',['岗位培训','现场带教'],['实操观察','异常推演'],['岗位授权','运行记录'],'practical'),
  T('hazardous_waste_management','危险废物全过程环境管理','环境管理','掌握识别、计划、台账、委托核实、转移联单、贮存和应急。',['法规培训','案例研讨'],['台账审核','案例考核'],['培训记录','能力评价'],'management'),
  T('hazardous_waste_operation','危险废物分类收集、包装与入库','环境管理','按废物特性分类、包装、称量、标签、相容性和入库。',['岗位培训','现场演示'],['实操观察'],['岗位考核','入库记录'],'practical'),
  T('hazardous_waste_labels','危险废物标签、标志与贮存设施','环境管理','正确设置标签、二维码和设施标志，检查容器、分区、防渗和台账。',['标准培训','现场演示'],['标签制作实操','现场检查'],['培训记录','检查记录'],'practical'),
  T('safety_signs','安全色、安全标志与管道识别更新','风险沟通','识别、设置、维护和更新安全标志，理解2025版标准变化。',['现场培训','标志巡查'],['现场辨识'],['培训记录','巡查记录'],'awareness'),
  T('barrier_management','关键屏障与安全关键任务','国际最佳实践','识别预防/减缓屏障、关键岗位任务、失效征兆和升级响应。',['案例研讨','屏障工作坊'],['案例分析','现场验证'],['能力评价','屏障验证记录'],'management'),
  T('human_performance','人因、HOP与公正文化','国际最佳实践','理解错误诱因、工作条件、学习团队、停工权和非惩罚性报告。',['案例研讨','学习团队'],['情景讨论','行动计划'],['参与记录','改进行动'],'awareness')
];

let n = 0;
const rules = [];
const add = (r) => rules.push({
  rule_id: `TM2-${String(++n).padStart(3,'0')}`,
  industries: [], roles_any: [], risk_tags_any: [], risk_tags_all: [], risk_tags_none: [],
  requirement_level: 'recommended', frequency: '由企业基于风险确定', minimum_duration: null,
  competence_level: null, assessment_requirement: null, record_requirement: '培训记录与效果评价',
  priority: 'medium', internal_review_required: true, ...r
});
const operational = ['operator','maintenance','electrician','instrument_technician','welding_worker','high_place_worker','lifting_worker','utilities_operator','laboratory','forklift_driver','warehouse','hazchem_warehouse','wastewater_operator','hazardous_waste_operator'];
const allWorkers = [...operational,'contractor_worker','newcomer'];
const leaders = ['principal','ehs','occupational_health_manager','environmental_manager','fire_manager','special_equipment_director','supervisor'];

for (const role of ['principal','ehs']) {
  add({roles_any:[role],risk_tags_none:['hazchem_high_risk_unit'],topic_id:role==='principal'?'principal_safety':'safety_manager',requirement_level:'mandatory',reason:'一般生产经营单位相应负责人/安全管理人员应接受安全培训并具备相应知识和能力。',source_ids:['safe_production_law','training_order_3'],training_trigger:'任职前完成初次培训；每年再培训',frequency:'初次培训＋每年再培训',minimum_duration:'初次不少于32学时；每年再培训不少于12学时',competence_level:'management',assessment_requirement:'按适用规定完成考核并持续具备履职能力',priority:'high'});
  add({roles_any:[role],risk_tags_all:['hazchem_high_risk_unit'],topic_id:role==='principal'?'principal_safety':'safety_manager',requirement_level:'mandatory',reason:'危险化学品等高危生产经营单位适用更高的负责人/安全管理人员培训学时和考核要求。',source_ids:['safe_production_law','training_order_3','hazchem_reg_591'],training_trigger:'任职前完成初次培训；每年再培训；任职后依法完成考核',frequency:'初次培训＋每年再培训',minimum_duration:'初次不少于48学时；每年再培训不少于16学时',competence_level:'management',assessment_requirement:'按法定范围完成安全生产知识和管理能力考核',priority:'high'});
}
add({roles_any:['principal'],topic_id:'training_governance',requirement_level:'mandatory',reason:'主要负责人负责组织制定并实施本单位安全生产教育培训计划。',source_ids:['safe_production_law','training_order_3'],training_trigger:'年度计划制定、组织实施和效果复核',frequency:'每年至少复核一次计划并持续实施',competence_level:'management',priority:'high'});
add({roles_any:['ehs'],topic_id:'training_governance',requirement_level:'mandatory',reason:'安全管理机构/人员应建立培训制度、计划和真实完整档案，并支持现场抽考。',source_ids:['safe_production_law','training_order_3'],training_trigger:'建档、年度计划、每次培训后和岗位变化时',frequency:'持续',competence_level:'management',assessment_requirement:'档案抽查与现场能力验证',record_requirement:'时间、内容、参加人员、考核结果等法定记录',priority:'high'});
add({roles_any:['occupational_health_manager'],risk_tags_all:['occupational_hazards'],topic_id:'oh_manager',requirement_level:'mandatory',reason:'存在职业病危害的用人单位职业卫生管理人员应接受与职责相适应的职业卫生培训。',source_ids:['occupational_disease_law','workplace_oh_5'],training_trigger:'任职前；法规、危害因素或职责变化时；按当地要求更新',frequency:'上岗/任职前＋定期',competence_level:'management',assessment_requirement:'掌握职业病防治法规、标准、危害控制和管理知识',priority:'high'});
add({roles_any:['environmental_manager'],risk_tags_any:['pollutant_permit','hazardous_waste','env_emergency','waste_gas_water_facility'],topic_id:'environment_manager',requirement_level:'conditional',reason:'承担环境管理职责的人员需要具备与排污、废物及环境风险相匹配的能力。',source_ids:['pollutant_permit_reg','pollutant_permit_measures','solid_waste_law','environment_emergency_34','iso14001_2026'],training_trigger:'任职前；许可、工艺、污染因子或法规变化时',frequency:'事件/变更触发＋企业定期复核',competence_level:'management',assessment_requirement:'通过台账、报告或情景任务验证',priority:'high'});
add({roles_any:['fire_manager'],risk_tags_any:['fire_explosion','fire_key_unit'],topic_id:'fire_manager',requirement_level:'mandatory',reason:'消防安全责任人、管理人及专兼职消防管理人员应接受消防安全专门培训。',source_ids:['fire_law','fire_order_61'],training_trigger:'任职前；消防职责、设施或风险变化时',frequency:'专门培训＋持续更新',competence_level:'management',assessment_requirement:'履职知识与现场能力确认',priority:'high'});
add({roles_any:['special_equipment_director'],risk_tags_all:['special_equipment'],topic_id:'special_equipment_governance',requirement_level:'mandatory',reason:'特种设备使用单位的安全总监、安全员应接受与设备类别和职责相适应的安全教育与技术培训。',source_ids:['special_equipment_law','special_equipment_order_74','tsg08_2026'],training_trigger:'任职前；设备类别、法规或职责变化时',frequency:'持续更新并结合履职评价',competence_level:'management',assessment_requirement:'履职清单与风险管控能力验证',priority:'high'});
add({roles_any:['supervisor'],topic_id:'supervisor_control',requirement_level:'conditional',reason:'管理人员需要组织岗位风险沟通、监督规程执行并确认人员能力。',source_ids:['safe_production_law','iso45001_2018','hse_competence'],training_trigger:'任职前；职责、工艺或风险变化时',frequency:'任职/变更触发＋定期现场复核',competence_level:'management',assessment_requirement:'现场领导行为和风险控制观察',priority:'high'});

add({roles_any:['newcomer'],risk_tags_none:['hazchem_high_risk_unit'],topic_id:'induction_general',requirement_level:'mandatory',reason:'加工制造等生产单位新上岗从业人员应接受厂、车间、班组三级安全培训并经培训合格后上岗。',source_ids:['safe_production_law','training_order_3'],training_trigger:'新上岗前；转岗、离岗一年以上复岗或岗位要求变化时重新培训',frequency:'上岗/转岗/复岗触发',minimum_duration:'岗前安全培训不少于24学时',competence_level:'practical',assessment_requirement:'培训合格并具备岗位操作和应急能力',priority:'high'});
add({roles_any:['newcomer'],risk_tags_all:['hazchem_high_risk_unit'],topic_id:'induction_high_risk',requirement_level:'mandatory',reason:'危险化学品等高危生产经营单位的新上岗人员适用更高岗前和年度再培训学时。',source_ids:['safe_production_law','training_order_3','hazchem_reg_591'],training_trigger:'新上岗前；每年再培训；转岗/复岗/变化时',frequency:'上岗前＋每年再培训',minimum_duration:'岗前不少于72学时；每年再培训不少于20学时',competence_level:'practical',assessment_requirement:'培训考核合格并具备岗位实操、自救互救和应急能力',priority:'high'});
add({roles_any:['newcomer'],risk_tags_all:['dispatched_intern'],topic_id:'dispatched_intern',requirement_level:'mandatory',reason:'被派遣劳动者和实习学生应纳入使用单位统一管理并接受岗位规程和技能培训。',source_ids:['safe_production_law','training_order_3'],training_trigger:'进入岗位前；岗位或作业变化时',frequency:'上岗/变化触发',competence_level:'practical',assessment_requirement:'岗位知识与实操确认',priority:'high'});
add({roles_any:operational,topic_id:'job_sop',requirement_level:'mandatory',reason:'从业人员应熟悉规章制度和操作规程，掌握岗位安全技能及应急措施，未经培训合格不得上岗。',source_ids:['safe_production_law','training_order_3'],training_trigger:'独立上岗前；转岗、复岗、规程或设备变化时',frequency:'上岗/变化触发＋企业定期复核',competence_level:'practical',assessment_requirement:'岗位实操或情景考核合格',priority:'high'});
add({roles_any:[...operational,'supervisor','process_engineer'],risk_tags_all:['change'],topic_id:'change_training',requirement_level:'mandatory',reason:'采用新工艺、新技术、新材料或使用新设备前，应了解安全技术特性并对有关人员进行专门培训。',source_ids:['safe_production_law'],training_trigger:'变更投用前',frequency:'每次适用变更',competence_level:'practical',assessment_requirement:'理解新风险、控制和异常响应后方可授权',priority:'high'});
add({roles_any:['contractor_manager'],risk_tags_all:['contractor'],topic_id:'contractor_management',requirement_level:'mandatory',reason:'发包/出租单位应审查安全条件或资质，明确职责并统一协调管理。',source_ids:['safe_production_law'],training_trigger:'承包商选择前、合同/范围变化时和项目复盘时',frequency:'项目/变更触发',competence_level:'management',assessment_requirement:'能力审查和接口方案评审',priority:'high'});
add({roles_any:['contractor_worker'],risk_tags_all:['contractor'],topic_id:'contractor_induction',requirement_level:'conditional',reason:'进入现场和开始作业前应接受现场规则、风险、应急和作业接口培训。',source_ids:['safe_production_law','hazchem_reg_591','iso45001_2018'],training_trigger:'入场前；每项作业前；场地、范围或规则变化时',frequency:'入场/作业/变化触发',competence_level:'awareness',assessment_requirement:'理解确认与现场抽问',priority:'high'});

add({roles_any:['operator','maintenance','instrument_technician','utilities_operator','laboratory','warehouse','hazchem_warehouse','wastewater_operator','hazardous_waste_operator','emergency_team'],risk_tags_any:['chemicals','hazchem_use'],topic_id:'chemical_hazards',requirement_level:'conditional',reason:'接触或处置危险化学品的岗位需掌握危害、控制、储运和异常处置。',source_ids:['hazchem_reg_591','safe_production_law','gb45673_2025'],training_trigger:'首次接触前；新增物料、用途、浓度或控制变化时',frequency:'接触/变化触发＋企业定期复核',competence_level:'knowledge',assessment_requirement:'危害与控制知识考核',priority:'high'});
add({roles_any:['operator','maintenance','laboratory','warehouse','hazchem_warehouse','wastewater_operator','hazardous_waste_operator','emergency_team'],risk_tags_any:['chemicals','hazchem_use'],topic_id:'sds_ghs',requirement_level:'conditional',reason:'岗位应能够获取并理解标签和安全技术说明书中的危害与防护信息。',source_ids:['hazchem_reg_591','osha_hazcom'],training_trigger:'首次分配工作前；引入此前未培训的新化学危害时',frequency:'上岗/新危害触发',competence_level:'practical',assessment_requirement:'现场查找SDS并解释标签/控制',priority:'high'});
add({industries:['chemical'],roles_any:['principal','ehs','supervisor','process_engineer','operator','maintenance','instrument_technician','utilities_operator'],risk_tags_any:['process_operation','hazchem_high_risk_unit'],topic_id:'process_safety',requirement_level:'conditional',reason:'化工过程岗位需要理解重大事故场景、屏障和过程安全管理要素。',source_ids:['gb45673_2025','aqt3034_2022','ccps_tpa'],training_trigger:'任职/上岗前；工艺、风险或职责变化时',frequency:'上岗/变化触发＋能力定期复核',competence_level:'knowledge',assessment_requirement:'基于本装置案例和关键屏障验证理解',priority:'high'});
add({industries:['chemical','pharma'],roles_any:['operator','supervisor','process_engineer','utilities_operator'],risk_tags_all:['process_operation'],topic_id:'operating_procedures',requirement_level:'conditional',reason:'涉及复杂工艺操作时应掌握操作边界、开停车、异常工况和紧急停车。',source_ids:['safe_production_law','hazchem_reg_591','aqt3034_2022','osha_psm'],training_trigger:'独立操作前；程序、工艺或设备变化时；发现偏差时再培训',frequency:'上岗/变化/绩效触发',competence_level:'practical',assessment_requirement:'模拟或现场实操考核',priority:'high'});
add({industries:['chemical','pharma'],roles_any:['process_engineer','supervisor','operator','maintenance','instrument_technician','ehs'],risk_tags_all:['change'],topic_id:'moc_pssr',requirement_level:'recommended',reason:'化工变更除法定“四新”培训外，宜通过MOC/PSSR确认受影响人员能力和投用条件。',source_ids:['aqt3034_2022','osha_psm'],training_trigger:'参与MOC/PSSR前及变更投用前',frequency:'每次适用变更',competence_level:'management',assessment_requirement:'MOC案例和PSSR清单评审',priority:'high'});
add({industries:['chemical'],roles_any:['principal','process_engineer','supervisor','operator','ehs'],risk_tags_all:['major_hazard'],topic_id:'major_hazard',requirement_level:'conditional',reason:'重大危险源相关主要、技术、操作和管理人员应理解风险、监测报警、检查和应急职责。',source_ids:['safe_production_law','hazchem_reg_591','aq3072_2026'],training_trigger:'承担职责前；重大危险源等级、物料、控制或标准变化时',frequency:'任职/变化触发＋定期履职复核',competence_level:'management',assessment_requirement:'包保职责和现场关键控制抽问',priority:'high'});
add({industries:['chemical'],roles_any:['process_engineer','supervisor','operator','instrument_technician','maintenance','ehs'],risk_tags_all:['regulated_process'],topic_id:'regulated_process',requirement_level:'conditional',reason:'重点监管危险化工工艺相关岗位需结合实际工艺完成专项知识和操作能力确认。',source_ids:['hazchem_reg_591','gb45673_2025','aq3067_2026'],training_trigger:'独立上岗前；工艺、联锁、操作规程或重大风险变化时',frequency:'上岗/变化触发＋企业定期复核',competence_level:'authorized',assessment_requirement:'针对具体工艺的理论和模拟/实操考核',priority:'high'});
add({industries:['chemical','pharma'],roles_any:['instrument_technician','operator','supervisor','process_engineer','ehs'],risk_tags_any:['regulated_process','process_operation'],topic_id:'alarm_interlock_override',requirement_level:'recommended',reason:'涉及报警、联锁和安全装置旁路的岗位宜掌握功能、响应、补偿措施和恢复验证。',source_ids:['aqt3034_2022','ccps_tpa'],training_trigger:'取得相关权限前；逻辑、程序或职责变化时',frequency:'授权/变化/事件触发',competence_level:'authorized',assessment_requirement:'旁路场景推演和权限确认',priority:'high'});

add({roles_any:['maintenance','electrician','instrument_technician','operator','utilities_operator','contractor_worker'],risk_tags_all:['equipment_maintenance'],topic_id:'maintenance_safety',requirement_level:'conditional',reason:'参与设备检维修应掌握交付、清洗置换、隔离、拆装、试运和恢复要求。',source_ids:['safe_production_law','aq3026_2026','aqt3034_2022'],training_trigger:'承担检维修任务前；设备、方案或作业条件变化时',frequency:'任务/变化触发',competence_level:'practical',assessment_requirement:'检维修方案和现场步骤验证',priority:'high'});
add({roles_any:['maintenance','electrician','instrument_technician','utilities_operator'],risk_tags_all:['loto'],topic_id:'loto_authorized',requirement_level:'conditional',reason:'实际实施危险能量隔离的授权人员需能识别能源、隔离并验证零能量。',source_ids:['safe_production_law','aqt3034_2022','osha_loto'],training_trigger:'获得隔离授权前；设备、程序、职责变化或发现偏差时再培训',frequency:'授权/变化/绩效触发',competence_level:'authorized',assessment_requirement:'逐项实操考核，不以课堂签到替代',priority:'high'});
add({roles_any:['operator','supervisor','contractor_worker'],risk_tags_all:['loto'],topic_id:'loto_affected',requirement_level:'recommended',reason:'受隔离影响或在相关区域工作的人员应理解禁启、沟通和边界要求。',source_ids:['aqt3034_2022','osha_loto'],training_trigger:'首次涉及LOTO区域前；程序或作业变化时',frequency:'上岗/变化触发',competence_level:'awareness',assessment_requirement:'现场抽问与行为观察',priority:'medium'});
add({roles_any:['welding_worker'],risk_tags_all:['hot_work'],topic_id:'hot_work_performer',requirement_level:'mandatory',reason:'直接从事焊接与热切割等特种作业应完成专门培训、考核取证并掌握2025版焊接切割安全要求。',source_ids:['safe_production_law','special_work_19','gb9448_2025','gb30871_2022'],training_trigger:'从事适用作业前；换证、工艺/设备或作业条件变化时',frequency:'取证/换证/变化触发',competence_level:'certified',assessment_requirement:'法定理论和实操考核＋企业现场授权',record_requirement:'有效特种作业操作证、培训与授权记录',priority:'high'});
add({roles_any:['permit_approver','supervisor','ehs','fire_manager','gas_tester','contractor_manager'],risk_tags_all:['hot_work'],topic_id:'hot_work_control',requirement_level:'conditional',reason:'动火审批、监护、检测和属地管理人员需掌握作业分级、分析、隔离和全过程控制。',source_ids:['fire_order_61','gb30871_2022','gb9448_2025'],training_trigger:'承担角色前；标准、区域或职责变化时',frequency:'授权/变化触发',competence_level:'authorized',assessment_requirement:'票证案例和现场控制考核',priority:'high'});
add({roles_any:['operator','maintenance','contractor_worker','utilities_operator','hazardous_waste_operator'],risk_tags_all:['confined_space'],topic_id:'confined_entry',requirement_level:'conditional',reason:'进入有限空间的作业人员应接受专项培训并掌握进入、撤离和禁止盲目施救要求。',source_ids:['confined_space_13','gb46768_2025','gb30871_2022','osha_confined'],training_trigger:'承担进入角色前；场所、程序、危害或职责变化时',frequency:'授权/变化触发＋企业定期复核',competence_level:'authorized',assessment_requirement:'情景或实操考核',priority:'high'});
add({roles_any:['confined_space_guardian'],risk_tags_all:['confined_space'],topic_id:'confined_guardian',requirement_level:'mandatory',reason:'有限空间监护人员应接受专项培训，掌握全程监护、联络、撤离和禁止盲目施救。',source_ids:['confined_space_13','gb46768_2025','gb30871_2022','osha_confined'],training_trigger:'承担监护职责前；场所、危害或程序变化时',frequency:'授权/变化触发＋定期实操复核',competence_level:'authorized',assessment_requirement:'监护情景实操考核',priority:'high'});
add({roles_any:['permit_approver','principal','supervisor','ehs'],risk_tags_all:['confined_space'],topic_id:'confined_approver',requirement_level:'conditional',reason:'有限空间审批人应能复核风险、隔离、检测、通风、救援和人员能力。',source_ids:['confined_space_13','gb46768_2025','gb30871_2022'],training_trigger:'承担审批职责前；程序或法规变化时',frequency:'授权/变化触发',competence_level:'authorized',assessment_requirement:'许可票和场景评审',priority:'high'});
add({roles_any:['gas_tester'],risk_tags_any:['confined_space','hot_work'],topic_id:'gas_testing',requirement_level:'conditional',reason:'承担作业气体检测的人员应具备仪器、采样、记录和判定能力。',source_ids:['gb46768_2025','gb30871_2022'],training_trigger:'承担检测职责前；仪器、标准或检测介质变化时',frequency:'授权/变化触发',competence_level:'authorized',assessment_requirement:'仪器实操和结果判定考核',priority:'high'});
add({roles_any:['emergency_team'],risk_tags_all:['confined_space'],topic_id:'confined_rescue',requirement_level:'conditional',reason:'承担有限空间救援的人员需完成针对性训练，优先掌握非进入救援和呼吸防护边界。',source_ids:['confined_space_13','gb46768_2025','emergency_reg_708','osha_confined'],training_trigger:'承担救援职责前；场所/装备变化时；演练暴露差距时',frequency:'训练＋定期演练',competence_level:'rescue',assessment_requirement:'实战演练评价',priority:'high'});
add({roles_any:['electrician'],risk_tags_any:['electrical_work','temporary_power'],topic_id:'electrical_special',requirement_level:'mandatory',reason:'直接从事适用电工作业应经专门安全技术培训考核并取得相应操作证。',source_ids:['safe_production_law','special_work_19'],training_trigger:'从事适用电工作业前；换证、作业项目或技术变化时',frequency:'取证/换证/变化触发',competence_level:'certified',assessment_requirement:'法定理论和实操考核＋企业授权',record_requirement:'有效操作证、培训与授权记录',priority:'high'});
add({roles_any:['electrician','permit_approver','supervisor','ehs','maintenance','contractor_worker'],risk_tags_all:['temporary_power'],topic_id:'temporary_power',requirement_level:'conditional',reason:'临时用电的设计、安装、审批、检查和使用人员需要按职责掌握控制要求。',source_ids:['gb30871_2022','safe_production_law'],training_trigger:'承担相应角色前；配电方案、环境或标准变化时',frequency:'授权/项目/变化触发',competence_level:'authorized',assessment_requirement:'现场检查或方案评审',priority:'high'});
add({roles_any:['high_place_worker'],risk_tags_all:['work_at_height'],topic_id:'work_at_height',requirement_level:'mandatory',reason:'从事特种作业目录范围内的高处作业应取证，并掌握现行高处作业分级与防坠落要求。',source_ids:['safe_production_law','special_work_19','gb3608_2025','gb30871_2022'],training_trigger:'作业前；取证/换证；设备、系统或作业条件变化时',frequency:'取证/换证/变化触发',competence_level:'certified',assessment_requirement:'法定考核＋防坠落实操和救援认知',priority:'high'});
add({roles_any:['lifting_worker'],risk_tags_all:['lifting'],topic_id:'lifting_operator',requirement_level:'conditional',reason:'起重机械司机、指挥等人员按设备类别和作业项目核对特种设备作业资格及现场能力。',source_ids:['special_equipment_law','tsg08_2026','gb30871_2022'],training_trigger:'独立作业前；取证/换证；设备、索具或吊装条件变化时',frequency:'资格/授权/变化触发',competence_level:'certified',assessment_requirement:'资格核验＋实操考核',priority:'high'});
add({roles_any:['permit_approver','supervisor','ehs','contractor_manager','process_engineer'],risk_tags_all:['lifting'],topic_id:'lifting_control',requirement_level:'conditional',reason:'吊装策划、审批和现场监督人员需能复核载荷、吊点、地基、人员、天气和警戒。',source_ids:['gb30871_2022','safe_production_law'],training_trigger:'承担角色前；重大/复杂吊装或条件变化时',frequency:'授权/项目/变化触发',competence_level:'authorized',assessment_requirement:'吊装方案案例评审',priority:'high'});
for (const [tag,topic,title] of [['excavation','excavation','动土/挖掘'],['road_breaking','road_breaking','断路/占道'],['blind_flange','blind_flange','盲板抽堵']]) {
  add({roles_any:['permit_approver','supervisor','ehs','maintenance','operator','contractor_worker'],risk_tags_all:[tag],topic_id:topic,requirement_level:'conditional',reason:`参与${title}作业的审批、属地、作业和监督人员应按职责掌握现场控制。`,source_ids:['gb30871_2022'],training_trigger:'承担角色前；作业范围、条件或标准变化时',frequency:'授权/项目/变化触发',competence_level:'practical',assessment_requirement:'票证或现场情景考核',priority:'high'});
}
add({roles_any:['permit_approver','supervisor','ehs','contractor_manager'],risk_tags_any:['hot_work','confined_space','work_at_height','temporary_power','lifting','excavation','road_breaking','blind_flange'],topic_id:'permit_to_work',requirement_level:'conditional',reason:'特殊作业管理角色应掌握许可全流程及作业条件变化后的暂停、重新确认和关闭。',source_ids:['gb30871_2022','safe_production_law'],training_trigger:'获得审批/监督权限前；标准、权限或流程变化时',frequency:'授权/变化触发＋定期案例复核',competence_level:'authorized',assessment_requirement:'许可票和现场案例考核',priority:'high'});
add({roles_any:['supervisor','operator','maintenance','electrician','instrument_technician','contractor_worker'],risk_tags_any:['equipment_maintenance','hot_work','confined_space','work_at_height','lifting','temporary_power'],topic_id:'jsa_lmra',requirement_level:'recommended',reason:'高风险任务宜在许可之外开展步骤化JSA和作业前动态确认。',source_ids:['iso45001_2018','hse_competence','risk_review'],training_trigger:'首次参与前；任务、环境或团队变化时',frequency:'任务/变化触发',competence_level:'practical',assessment_requirement:'真实任务JSA质量和现场观察',priority:'medium'});

add({roles_any:['forklift_driver'],risk_tags_any:['vehicles','special_equipment'],topic_id:'forklift',requirement_level:'mandatory',reason:'场（厂）内专用机动车辆作业人员应按规定取得相应资格并具备设备操作能力。',source_ids:['special_equipment_law','tsg08_2026'],training_trigger:'独立驾驶前；取证/换证；车辆、附件、路线或工况变化时',frequency:'资格/授权/变化触发',competence_level:'certified',assessment_requirement:'法定考核＋企业驾驶实操和路线授权',priority:'high'});
add({roles_any:['warehouse','hazchem_warehouse','forklift_driver','operator','contractor_worker','supervisor'],risk_tags_all:['vehicles'],topic_id:'traffic_safety',requirement_level:'conditional',reason:'处于厂内交通和装卸区域的人员需掌握路线、行人优先、倒车和装卸接口要求。',source_ids:['safe_production_law','hse_competence'],training_trigger:'进入相关区域/岗位前；路线、设施或交通组织变化时',frequency:'上岗/变化触发',competence_level:'practical',assessment_requirement:'路线踏勘和现场行为观察',priority:'high'});
add({roles_any:['utilities_operator','lifting_worker','forklift_driver'],risk_tags_all:['special_equipment'],topic_id:'special_equipment_operator',requirement_level:'conditional',reason:'承担特种设备作业项目的人员应按设备类别取得资格并严格执行操作规程。',source_ids:['special_equipment_law','special_equipment_order_74','tsg08_2026'],training_trigger:'独立作业前；资格维护；设备或作业项目变化时',frequency:'资格/授权/变化触发',competence_level:'certified',assessment_requirement:'资格核验与设备实操',priority:'high'});
add({roles_any:['utilities_operator','maintenance','operator','special_equipment_director'],risk_tags_all:['pressure_system'],topic_id:'pressure_system',requirement_level:'conditional',reason:'锅炉、压力容器、压力管道或气瓶相关岗位需掌握设备边界、附件、巡检和异常处置。',source_ids:['special_equipment_law','tsg08_2026'],training_trigger:'上岗/任职前；设备、介质、规程或法规变化时',frequency:'上岗/变化触发＋设备专项复核',competence_level:'practical',assessment_requirement:'设备现场抽问或实操',priority:'high'});
add({roles_any:['warehouse','hazchem_warehouse','forklift_driver','contractor_worker'],risk_tags_any:['vehicles','hazchem_use','chemicals'],topic_id:'warehouse_safety',requirement_level:'conditional',reason:'仓储装卸岗位应掌握分区、堆垛、相容性、装卸和异常处置。',source_ids:['safe_production_law','hazchem_reg_591'],training_trigger:'上岗前；物料、货架、装卸设备或布局变化时',frequency:'上岗/变化触发',competence_level:'practical',assessment_requirement:'现场观察和异常情景考核',priority:'high'});
add({roles_any:['laboratory'],risk_tags_any:['lab_risk','chemicals','hazardous_waste','pressure_system'],topic_id:'lab_safety',requirement_level:'conditional',reason:'实验室人员需结合试剂、反应、设备、气瓶和废物风险完成专项培训。',source_ids:['safe_production_law','hazchem_reg_591','solid_waste_law','iso45001_2018'],training_trigger:'实验授权前；试剂、反应、设备或程序变化时',frequency:'授权/变化触发',competence_level:'practical',assessment_requirement:'现场操作与应急情景考核',priority:'high'});

add({roles_any:[...operational,'contractor_worker'],risk_tags_all:['occupational_hazards'],topic_id:'occupational_health_worker',requirement_level:'mandatory',reason:'接触职业病危害的劳动者应接受上岗前和在岗期间定期职业卫生培训；危害严重岗位应专门培训合格。',source_ids:['occupational_disease_law','workplace_oh_5'],training_trigger:'上岗前；在岗期间定期；危害因素、工艺、设备、材料或岗位变化时重新培训',frequency:'上岗前＋在岗定期＋变化触发',competence_level:'knowledge',assessment_requirement:'危害、控制、PPE和异常报告知识/实操确认',priority:'high'});
add({roles_any:[...operational,'contractor_worker'],risk_tags_all:['occupational_hazards'],topic_id:'health_surveillance',requirement_level:'conditional',reason:'接触职业病危害的劳动者需理解职业健康检查安排、结果告知和复查要求。',source_ids:['occupational_disease_law','workplace_oh_5','gbz188_2025'],training_trigger:'首次接害前；体检安排、危害或岗位变化时',frequency:'接害/体检/变化触发',competence_level:'awareness',assessment_requirement:'流程与个人权利义务确认',priority:'medium'});
add({roles_any:[...operational,'contractor_worker','emergency_team'],risk_tags_all:['ppe'],topic_id:'ppe',requirement_level:'mandatory',reason:'需要使用PPE的人员应接受正确选择、佩戴、使用、维护和报废培训并由企业督促使用。',source_ids:['safe_production_law','occupational_disease_law','gb39800_1'],training_trigger:'首次使用前；危害、PPE型号或使用条件变化时；发现错误使用时再培训',frequency:'使用/变化/绩效触发',competence_level:'practical',assessment_requirement:'穿戴与检查实操，不以发放签字替代',priority:'high'});
add({roles_any:['operator','maintenance','laboratory','utilities_operator','hazardous_waste_operator','emergency_team','contractor_worker'],risk_tags_all:['respiratory_protection'],topic_id:'respiratory_protection',requirement_level:'conditional',reason:'使用呼吸防护用品的人员需掌握选型边界、密合、使用限制、维护和紧急撤离。',source_ids:['occupational_disease_law','gb39800_1','risk_review'],training_trigger:'首次使用前；面具/滤盒、面部条件、危害或程序变化时',frequency:'使用/变化触发＋定期实操复核',competence_level:'authorized',assessment_requirement:'佩戴、正负压检查和适合性验证',priority:'high'});
add({roles_any:[...operational,'contractor_worker'],risk_tags_all:['noise'],topic_id:'hearing_conservation',requirement_level:'conditional',reason:'噪声暴露人员应了解危害、工程控制、听力防护和职业健康监护。',source_ids:['occupational_disease_law','workplace_oh_5','gbz188_2025','gb39800_1'],training_trigger:'上岗/接害前；噪声、控制或防护用品变化时',frequency:'上岗前＋在岗定期＋变化触发',competence_level:'knowledge',assessment_requirement:'佩戴观察和健康监护流程理解',priority:'medium'});
add({roles_any:['operator','maintenance','warehouse','laboratory','hazardous_waste_operator','contractor_worker'],risk_tags_all:['manual_handling'],topic_id:'ergonomics',requirement_level:'recommended',reason:'存在人工搬运、重复动作或不良姿势时，宜通过训练和工程改进降低肌肉骨骼风险。',source_ids:['iso45001_2018','hse_competence','risk_review'],training_trigger:'上岗前；任务、负荷或工具变化时；出现不适/事件时',frequency:'上岗/变化/事件触发',competence_level:'practical',assessment_requirement:'现场动作观察和改进',priority:'medium'});

add({roles_any:allWorkers,risk_tags_any:['fire_explosion','fire_key_unit'],topic_id:'fire_all',requirement_level:'mandatory',reason:'员工应掌握本岗位火灾危险、防火措施、消防设施、报警、初起火灾处置和逃生。',source_ids:['fire_law','fire_order_61'],training_trigger:'新上岗/新岗位前；消防风险、设施或预案变化时',frequency:'重点单位每名员工至少每年一次；公众聚集场所至少每半年一次；其他单位经常性教育并按实际组织',competence_level:'practical',assessment_requirement:'灭火器材或疏散情景实操',priority:'high'});
add({roles_any:['fire_manager','principal','ehs'],risk_tags_all:['fire_key_unit'],topic_id:'fire_key_roles',requirement_level:'mandatory',reason:'消防安全重点岗位应接受专门培训并组织员工培训和灭火疏散演练。',source_ids:['fire_order_61'],training_trigger:'任职前；职责、设施、重点部位或法规变化时',frequency:'专门培训＋持续履职复核',competence_level:'management',assessment_requirement:'制度、检查、设施和预案履职评价',priority:'high'});
add({roles_any:[...allWorkers,'supervisor'],risk_tags_all:['emergency'],topic_id:'emergency_general',requirement_level:'mandatory',reason:'从业人员应掌握本岗位应急措施、报警和疏散要求，预案应通过培训和演练落实。',source_ids:['safe_production_law','emergency_reg_708','emergency_plan_88'],training_trigger:'上岗前；预案、风险或职责变化时；演练暴露差距时',frequency:'上岗/变化触发＋按预案计划培训演练',competence_level:'practical',assessment_requirement:'情景或演练评价',priority:'high'});
add({roles_any:['emergency_team'],risk_tags_any:['emergency','spill_response','fire_explosion','confined_space'],topic_id:'emergency_team',requirement_level:'mandatory',reason:'应急救援人员应经培训合格后参加救援，并定期训练。',source_ids:['emergency_reg_708','emergency_plan_88'],training_trigger:'加入队伍前；职责、风险、装备或预案变化时；演练/事件后',frequency:'准入培训＋定期训练和演练',competence_level:'rescue',assessment_requirement:'实战演练与体能/装备使用评价',priority:'high'});
add({roles_any:['first_aider','emergency_team'],risk_tags_any:['emergency','confined_space'],topic_id:'first_aid',requirement_level:'recommended',reason:'承担现场急救或救援职责的人员宜完成CPR/AED和创伤急救实操训练并维持能力。',source_ids:['emergency_reg_708','osha_confined','risk_review'],training_trigger:'承担职责前；证书/技能复训；演练或事件暴露差距时',frequency:'按认证/企业方案复训并定期实操',competence_level:'rescue',assessment_requirement:'CPR/AED和创伤处置实操',priority:'high'});
add({roles_any:['operator','warehouse','hazchem_warehouse','laboratory','wastewater_operator','hazardous_waste_operator','emergency_team','contractor_worker'],risk_tags_all:['spill_response'],topic_id:'spill_response',requirement_level:'conditional',reason:'可能发现或参与化学品泄漏先期处置的岗位需掌握报警、隔离、围堵、PPE和升级条件。',source_ids:['hazchem_reg_591','environment_emergency_34','gb18597_2023'],training_trigger:'上岗/承担职责前；物料、设施、装备或预案变化时',frequency:'上岗/变化触发＋演练',competence_level:'practical',assessment_requirement:'情景或实操演练',priority:'high'});

add({roles_any:['environmental_manager','wastewater_operator','emergency_team','operator','utilities_operator'],risk_tags_all:['env_emergency'],topic_id:'environmental_emergency',requirement_level:'mandatory',reason:'适用单位应开展环境应急预案培训、宣传和必要演练，相关岗位应熟悉职责和处置程序。',source_ids:['environment_emergency_34','environment_plan_filing'],training_trigger:'预案发布/修订后；岗位职责变化时；演练或事件暴露差距时',frequency:'按预案计划定期培训和演练',competence_level:'practical',assessment_requirement:'桌面或实战演练评价',priority:'high'});
add({roles_any:['environmental_manager','supervisor','operator','warehouse','laboratory','wastewater_operator','hazardous_waste_operator'],risk_tags_any:['pollutant_permit','hazardous_waste','waste_gas_water_facility'],topic_id:'environmental_awareness',requirement_level:'recommended',reason:'岗位人员宜理解与其工作相关的环境因素、合规义务、异常报告和污染预防控制。',source_ids:['iso14001_2026','risk_review'],training_trigger:'上岗前；环境因素、许可或运行控制变化时',frequency:'上岗/变化触发＋企业定期沟通',competence_level:'awareness',assessment_requirement:'岗位环境情景问答',priority:'medium'});
add({roles_any:['environmental_manager','wastewater_operator'],risk_tags_all:['pollutant_permit'],topic_id:'pollutant_permit',requirement_level:'conditional',reason:'负责排污许可、台账、自行监测和执行报告的人员应具备准确履行许可要求的能力。',source_ids:['pollutant_permit_reg','pollutant_permit_measures'],training_trigger:'承担职责前；许可证申请/变更、监测方案或平台变化时',frequency:'任职/许可/变化触发',competence_level:'management',assessment_requirement:'使用真实结构的虚构台账/报告进行实操考核',priority:'high'});
add({roles_any:['wastewater_operator','utilities_operator','environmental_manager'],risk_tags_all:['waste_gas_water_facility'],topic_id:'pollution_facility',requirement_level:'conditional',reason:'污染防治设施应按要求运行维护，岗位需掌握参数、记录和异常报告。',source_ids:['pollutant_permit_reg','pollutant_permit_measures'],training_trigger:'独立上岗前；设施、药剂、参数、许可或程序变化时',frequency:'上岗/变化触发＋定期实操复核',competence_level:'practical',assessment_requirement:'现场操作和异常工况推演',priority:'high'});
add({roles_any:['hazardous_waste_manager','environmental_manager'],risk_tags_all:['hazardous_waste'],topic_id:'hazardous_waste_management',requirement_level:'conditional',reason:'承担危险废物管理职责需掌握识别、计划、台账、委托核实、转移、贮存和应急。',source_ids:['solid_waste_law','gb18597_2023','hj1276_2022'],training_trigger:'任职前；废物类别、工艺、贮存设施、转移或法规变化时',frequency:'任职/变化触发＋定期复核',competence_level:'management',assessment_requirement:'台账、标签、贮存和委托案例审核',priority:'high'});
add({roles_any:['hazardous_waste_operator','laboratory','warehouse','wastewater_operator'],risk_tags_all:['hazardous_waste'],topic_id:'hazardous_waste_operation',requirement_level:'conditional',reason:'实际收集、包装、称量、标签或入库人员需要掌握相容性和操作要求。',source_ids:['solid_waste_law','gb18597_2023','hj1276_2022'],training_trigger:'承担操作前；废物、包装、设施或流程变化时',frequency:'上岗/变化触发',competence_level:'practical',assessment_requirement:'分类、包装、标签和入库实操',priority:'high'});
add({roles_any:['hazardous_waste_manager','hazardous_waste_operator','laboratory','warehouse'],risk_tags_all:['hazardous_waste'],topic_id:'hazardous_waste_labels',requirement_level:'conditional',reason:'相关人员需按现行标准设置和检查危险废物标签、设施标志及贮存条件。',source_ids:['gb18597_2023','hj1276_2022'],training_trigger:'承担职责前；标签规范、废物或设施变化时',frequency:'上岗/变化触发',competence_level:'practical',assessment_requirement:'标签制作和现场检查实操',priority:'high'});

add({roles_any:[...allWorkers,'supervisor'],risk_tags_any:['fire_explosion','chemicals','confined_space','work_at_height','vehicles','ppe'],topic_id:'safety_signs',requirement_level:'conditional',reason:'岗位人员应理解现场安全色、安全标志和管道/区域风险沟通；2025版标准已实施。',source_ids:['safe_production_law','gb2894_2025'],training_trigger:'上岗前；标志、区域、管道或风险变化时',frequency:'上岗/变化触发',competence_level:'awareness',assessment_requirement:'现场辨识和含义抽问',priority:'medium'});
add({roles_any:['operator','maintenance','supervisor','ehs','contractor_worker'],risk_tags_all:['combustible_dust'],topic_id:'process_safety',requirement_level:'conditional',reason:'可燃性粉尘场所人员需理解粉尘爆炸五要素、积尘、点火源和除尘系统控制。',source_ids:['safe_production_law','risk_review'],training_trigger:'上岗前；粉尘、工艺、除尘或清扫方式变化时',frequency:'上岗/变化触发',competence_level:'knowledge',assessment_requirement:'现场危险辨识和控制问答',priority:'high'});

for (const role of leaders) add({roles_any:[role],topic_id:'competence_assurance',requirement_level:'recommended',reason:'国际最佳实践要求按职责与风险确定能力，不以培训签到替代现场胜任。',source_ids:['iso45001_2018','ccps_tpa','hse_competence'],training_trigger:'任职前；定期绩效评估；变更、事件或观察发现差距时',frequency:'持续绩效保证',competence_level:'management',assessment_requirement:'知识、实操、现场表现和主管确认组合验证',priority:'medium'});
add({industries:['chemical'],roles_any:['principal','ehs','supervisor','process_engineer','operator','maintenance','instrument_technician'],risk_tags_any:['process_operation','major_hazard','regulated_process'],topic_id:'barrier_management',requirement_level:'recommended',reason:'重大过程风险岗位宜识别关键屏障、安全关键任务和屏障失效升级路径。',source_ids:['aqt3034_2022','ccps_tpa'],training_trigger:'建立/变更风险控制时；屏障测试失败或事件后',frequency:'变化/事件触发＋定期验证',competence_level:'management',assessment_requirement:'用本装置虚构场景完成屏障验证',priority:'medium'});
add({roles_any:['principal','ehs','supervisor','operator','maintenance','contractor_manager'],topic_id:'incident_reporting',requirement_level:'recommended',reason:'建立及时报告事件、未遂和异常的共同认知，支持事故学习而非仅追责。',source_ids:['iso45001_2018','ccps_tpa'],training_trigger:'入职/任职前；报告流程变化时；事件后复盘',frequency:'上岗/变化/事件触发',competence_level:'awareness',assessment_requirement:'情景判断与报告路径演练',priority:'medium'});
add({roles_any:['principal','ehs','supervisor'],topic_id:'human_performance',requirement_level:'recommended',reason:'领导和一线主管宜理解人因、工作条件、停工权和学习型改进方法。',source_ids:['iso45001_2018','ccps_tpa','hse_competence'],training_trigger:'任职前；事件、组织或文化项目需要时',frequency:'任职/事件触发＋持续辅导',competence_level:'management',assessment_requirement:'案例讨论与改进行动',priority:'low'});

const topicIds = new Set(topics.map(x => x.topic_id));
const roleIds = new Set(roles.map(x => x.id));
const riskIds = new Set(riskTags.map(x => x.id));
const sourceIds = new Set(sources.map(x => x.source_id));
for (const r of rules) {
  if (!topicIds.has(r.topic_id)) throw new Error(`Unknown topic ${r.topic_id}`);
  for (const id of r.roles_any) if (!roleIds.has(id)) throw new Error(`Unknown role ${id}`);
  for (const id of [...r.risk_tags_any,...r.risk_tags_all,...r.risk_tags_none]) if (!riskIds.has(id)) throw new Error(`Unknown risk ${id}`);
  for (const id of r.source_ids) if (!sourceIds.has(id)) throw new Error(`Unknown source ${id}`);
}

const catalog = {
  version: '0.2.0',
  verified_at: verifiedAt,
  jurisdiction: '中华人民共和国全国通用基线',
  scope_note: '不含地方性法规、行业专项许可细则及企业内部制度；企业须结合所在地、许可类别、设备目录和岗位风险复核。',
  industries, roles, risk_tags: riskTags, topics, sources, rules
};
fs.writeFileSync(out, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Wrote ${out}`);
console.log(JSON.stringify({industries:industries.length,roles:roles.length,risk_tags:riskTags.length,topics:topics.length,sources:sources.length,rules:rules.length}));
