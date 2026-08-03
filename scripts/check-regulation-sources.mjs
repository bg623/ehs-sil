import fs from "node:fs";
const sources=[
  {name:"国家法律法规数据库",url:"https://flk.npc.gov.cn/",mode:"official_entry_check",priority:"P0",scope:"法律、地方性法规、司法解释"},
  {name:"国家行政法规库",url:"https://xzfg.moj.gov.cn/",mode:"manual_review_required",priority:"P0",scope:"现行行政法规及历史沿革",note:"GitHub云端无法稳定连接，保留官方入口并人工复核"},
  {name:"应急管理部法律法规标准",url:"https://www.mem.gov.cn/fw/flfgbz/",mode:"official_entry_check",priority:"P0",scope:"安全生产法律、规章、AQ标准、规范性文件"},
  {name:"全国标准信息公共服务平台",url:"https://std.samr.gov.cn/",mode:"official_entry_check",priority:"P0",scope:"国标、行标、地标元数据及版本状态"},
  {name:"国家标准全文公开系统",url:"https://openstd.samr.gov.cn/",mode:"official_entry_check",priority:"P0",scope:"国家标准正式公开文本"},
  {name:"生态环境部法规标准",url:"https://www.mee.gov.cn/ywgz/fgbz/",mode:"official_entry_check",priority:"P0",scope:"生态环境法律、规章及HJ标准"},
  {name:"国家卫生健康委职业卫生标准",url:"https://www.nhc.gov.cn/wjw/pyl/wsbz.shtml",mode:"manual_review_required",priority:"P1",scope:"GBZ职业卫生标准及生效信息",note:"官网对自动访问返回412，保留官方入口并人工复核"},
  {name:"市场监管总局特种设备安全监察局",url:"https://www.samr.gov.cn/tzsbj/",mode:"manual_review_required",priority:"P1",scope:"TSG安全技术规范及特种设备监管文件",note:"GitHub云端无法稳定连接，保留官方入口并人工复核"},
  {name:"国家消防救援局",url:"https://www.119.gov.cn/",mode:"manual_review_required",priority:"P1",scope:"消防规章、规范性文件及标准动态",note:"官网限制自动访问，保留官方入口并人工复核"},
  {name:"淄博市应急管理局",url:"https://ajj.zibo.gov.cn/",mode:"local_official_entry_check",priority:"P1",scope:"属地安全生产政策、执法和地方执行口径"}
];
async function check(source){if(source.mode==="manual_review_required")return {...source,status:"manual_review_required",checkedAt:new Date().toISOString(),attempts:0};let lastError="";for(let attempt=1;attempt<=2;attempt++){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const response=await fetch(source.url,{headers:{"user-agent":"EHS-SIL-Regulation-Source-Check/1.1 (+https://ehs-sil.com)"},signal:controller.signal,redirect:"follow"});clearTimeout(timer);return {...source,status:response.ok?"available":"failed",httpStatus:response.status,checkedAt:new Date().toISOString(),attempts:attempt};}catch(error){clearTimeout(timer);lastError=error.name==="AbortError"?"timeout":String(error.message||error).slice(0,160);}}return {...source,status:"failed",error:lastError,checkedAt:new Date().toISOString(),attempts:2};}
const results=[];for(const source of sources)results.push(await check(source));const output={checkedAt:new Date().toISOString(),sources:results,fallback:"单个来源失败不影响其他来源；保留现有受控库并进入人工复核，候选不会自动发布。"};
if(process.argv.includes("--write"))fs.writeFileSync(new URL("../data/source-status.json",import.meta.url),JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify(output,null,2));
