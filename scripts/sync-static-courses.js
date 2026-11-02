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
copyDir(SRC13, D13, f => f.startsWith("ws-") && f.endsWith(".html"));
fs.writeFileSync(path.join(D13, "practice-react.html"), wrap(fs.readFileSync(path.join(SRC13, "ฝึกแอปแรก_IonicReact.html"), "utf8")));
let idx13 = fs.readFileSync(path.join(SRC13, "index.html"), "utf8");
const extra13 = '<div class="card"><h2>เริ่มที่นี่</h2><div class="li"><a href="practice-react.html">ฝึกเขียนแอปแรก Ionic React (ทีละขั้น)</a></div></div><div class="card"><h2>แบบฟอร์มดาวน์โหลด</h2><div class="li"><a href="/downloads/usecase-diagram-form.docx" download>แบบฝึก Use Case Diagram (ใบงาน 2.2) ไฟล์ Word</a></div></div>';
idx13 = idx13.replace(/<main>/, "<main>" + hubLink + extra13);
fs.writeFileSync(path.join(D13, "index.html"), idx13);

// ---- หน้ารวมวิชา ----
console.log("copied:", fs.readdirSync(D09).length, "files in mobile-2009;", fs.readdirSync(D13).length, "files in hybrid-2013");
