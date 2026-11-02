// คัดลอกหน้าเว็บของวิชา 31901-2009 และ 31901-2013 มาไว้ใน public/ เพื่อให้เปิดจากหน้ารวมวิชา (/) ได้
// รัน: node scripts/sync-static-courses.js   (รันซ้ำได้เมื่อแก้หน้าต้นทาง)
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");           // โฟลเดอร์ แผนการสอน2569
const PUB = path.resolve(__dirname, "..", "public");
const SRC09 = path.join(ROOT, "31901-2009_การพัฒนาซอฟต์แวร์สำหรับอุปกรณ์เคลื่อนที่", "web");
const SRC13 = path.join(ROOT, "31901-2013_การพัฒนาไฮบริดแอปพลิเคชัน", "web");

const HEAD = '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n';
const BACK = '<p style="margin:0;padding:8px 16px;font:14px system-ui,sans-serif"><a href="/">&larr; หน้ารวมวิชา</a></p>\n';
// หน้าที่เขียนสำหรับ Artifact ไม่มี doctype/head ในตัว จึงห่อให้ครบเมื่อวางเป็นไฟล์จริง
const wrap = html => HEAD + html.replace("</style>", "</style>\n</head><body>" + BACK + "\n") + "\n</body></html>\n";
const hubLink = '<div class="mu" style="margin:0 0 8px"><a href="/">&larr; หน้ารวมวิชา</a></div>';

function copyDir(from, to, filter) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) if (filter(f)) fs.copyFileSync(path.join(from, f), path.join(to, f));
}

// ---- ไฟล์แบบฟอร์มให้ดาวน์โหลด ----
const DL = path.join(PUB, "downloads");
fs.mkdirSync(DL, { recursive: true });
fs.copyFileSync(path.join(ROOT, "31901-2009_การพัฒนาซอฟต์แวร์สำหรับอุปกรณ์เคลื่อนที่", "แบบฟอร์ม", "แบบฝึก_UseCaseDiagram.docx"), path.join(DL, "usecase-diagram-form.docx"));

// ---- 31901-2009 ----
const D09 = path.join(PUB, "mobile-2009");
copyDir(SRC09, D09, f => /^ws-\d+\.\d+\.html$/.test(f));
fs.writeFileSync(path.join(D09, "practice.html"), wrap(fs.readFileSync(path.join(SRC09, "ฝึกแอปแรก.html"), "utf8")));
fs.writeFileSync(path.join(D09, "style-guide.html"), wrap(fs.readFileSync(path.join(SRC09, "คู่มือสไตล์.html"), "utf8")));
let idx = fs.readFileSync(path.join(SRC09, "index.html"), "utf8");
const extra09 = '<div class="card"><h2>เริ่มที่นี่</h2><div class="li"><a href="practice.html">ฝึกเขียนแอปแรก React Native (ทีละขั้น)</a><a href="style-guide.html">คู่มือสไตล์ StyleSheet (ค้นหาได้)</a></div></div><div class="card"><h2>แบบฟอร์มดาวน์โหลด</h2><div class="li"><a href="/downloads/usecase-diagram-form.docx" download>แบบฝึก Use Case Diagram (ใบงาน 2.2) ไฟล์ Word</a></div></div>';
idx = idx.replace(/<main>/, "<main>" + hubLink + extra09);
fs.writeFileSync(path.join(D09, "index.html"), idx);

// ---- 31901-2013 ----
const D13 = path.join(PUB, "hybrid-2013");
fs.mkdirSync(D13, { recursive: true });
fs.writeFileSync(path.join(D13, "practice-react.html"), wrap(fs.readFileSync(path.join(SRC13, "ฝึกแอปแรก_IonicReact.html"), "utf8")));
fs.writeFileSync(path.join(D13, "index.html"), HEAD + `<title>31901-2013 การพัฒนาไฮบริดแอปพลิเคชัน</title>
<style>
:root{--bg:#f6f7fb;--card:#fff;--tx:#1f2937;--mu:#6b7280;--ac:#2563eb;--bd:#e5e7eb}
@media(prefers-color-scheme:dark){:root{--bg:#0f172a;--card:#1e293b;--tx:#e5e7eb;--mu:#94a3b8;--ac:#60a5fa;--bd:#334155}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:19px/1.75 "Sarabun",system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:20px 16px 60px}a{color:var(--ac)}
.card{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:16px 18px;margin:14px 0}
h1{font-size:1.5rem;margin:.2em 0}h2{font-size:1.1rem;margin:0 0 .4em}.mu{color:var(--mu)}
.li a{display:block;padding:8px 12px;border:1px solid var(--bd);border-radius:8px;margin:6px 0;text-decoration:none}
</style></head><body><main>
<div class="mu"><a href="/">&larr; หน้ารวมวิชา</a></div>
<h1>31901-2013 การพัฒนาไฮบริดแอปพลิเคชัน</h1>
<p class="mu">เครื่องมือ: Node.js, VS Code, Ionic CLI, React, Capacitor และ Chrome (โหมดจำลองอุปกรณ์)</p>
<div class="card"><h2>เริ่มที่นี่</h2><div class="li"><a href="practice-react.html">ฝึกเขียนแอปแรก Ionic React (ทีละขั้น)</a></div></div>
<div class="card"><h2>แบบฟอร์มดาวน์โหลด</h2><div class="li"><a href="/downloads/usecase-diagram-form.docx" download>แบบฝึก Use Case Diagram (ใบงาน 2.2) ไฟล์ Word</a></div></div>
<div class="card"><h2>ใบงานอื่น ๆ</h2><p class="mu">ครูกำลังทยอยเพิ่มใบงานของแต่ละหน่วย</p></div>
</main></body></html>
`);

// ---- หน้ารวมวิชา ----
console.log("copied:", fs.readdirSync(D09).length, "files in mobile-2009;", fs.readdirSync(D13).length, "files in hybrid-2013");
