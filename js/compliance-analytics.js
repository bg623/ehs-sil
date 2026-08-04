/** Privacy-limited analytics for the compliance identification tool. */
(function(){"use strict";
const CATEGORY="compliance_identification",allowed=new Set(["example_used","result_generated","export_clicked","excel_exported","detail_opened","vip_prompt_viewed","vip_entry_clicked","knowledge_planet_clicked"]);
function track(eventName,mode){if(!allowed.has(eventName))return false;const safeMode=mode==="example"?"example":"user";window._hmt=window._hmt||[];window._hmt.push(["_trackEvent",CATEGORY,eventName,safeMode]);window.dispatchEvent(new CustomEvent("ehs-sil:compliance-analytics",{detail:{event:eventName,mode:safeMode}}));return true;}
window.EhsComplianceAnalytics={track,allowedEvents:[...allowed]};
})();
