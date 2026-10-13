// รวมใบความรู้ทุกหน่วย (หน่วยละ 1 ไฟล์) เป็นอ็อบเจ็กต์เดียว key = เลขหน่วย
// โครงสร้างของแต่ละหน่วย: { unit, intro, objectives[], sections:[{id,title,blocks[]}], summary[], terms[[คำ,ความหมาย]], questions[] }
// block: {t:"p",x} | {t:"ul",items} | {t:"ol",items} | {t:"code",lang,x} | {t:"note",kind:"tip|warn|info",x} | {t:"table",head,rows}
// ในข้อความใช้ **ตัวหนา** และ `โค้ดในบรรทัด` ได้
const KNOWLEDGE = {};
for (let n = 1; n <= 8; n++) {
  try {
    KNOWLEDGE[n] = require(`./unit${n}.js`);
  } catch (e) {
    if (e.code !== "MODULE_NOT_FOUND") throw e;
  }
}
module.exports = KNOWLEDGE;
