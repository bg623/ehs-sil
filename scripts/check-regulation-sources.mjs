import fs from "node:fs";
const sources=[
  {name:"国家法律法规数据库",url:"https://flk.npc.gov.cn/",mode:"official_entry_check"},
  {name:"国家标准全文公开系统",url:"https://openstd.samr.gov.cn/",mode:"official_entry_check"},
  {name:"应急管理部",url:"https://www.mem.gov.cn/fw/flfgbz/",mode:"official_entry_check"},
  {name:"山东省地方标准",url:"https://dbba.sacinfo.org.cn/",mode:"candidate_only"},
  {name:"淄博市主管部门",url:"https://ajj.zibo.gov.cn/",mode:"candidate_only"}
];
async function check(source){let lastError="";for(let attempt=1;attempt<=2;attempt++){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const response=await fetch(source.url,{headers:{"user-agent":"EHS-SIL-Regulation-Source-Check/1.1 (+https://ehs-sil.com)"},signal:controller.signal,redirect:"follow"});clearTimeout(timer);return {...source,status:response.ok?"available":"failed",httpStatus:response.status,checkedAt:new Date().toISOString(),attempts:attempt};}catch(error){clearTimeout(timer);lastError=error.name==="AbortError"?"timeout":String(error.message||error).slice(0,160);}}return {...source,status:"failed",error:lastError,checkedAt:new Date().toISOString(),attempts:2};}
const results=[];for(const source of sources)results.push(await check(source));const output={checkedAt:new Date().toISOString(),sources:results,fallback:"单个来源失败不影响其他来源；保留现有受控库并进入人工复核，候选不会自动发布。"};
if(process.argv.includes("--write"))fs.writeFileSync(new URL("../data/source-status.json",import.meta.url),JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify(output,null,2));
