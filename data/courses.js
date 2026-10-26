// โหลดทุกวิชาจากโฟลเดอร์ data/courses/<รหัสวิชา>/ อัตโนมัติ (ดูรูปแบบไฟล์ใน data/courses/README.md)
// เพิ่มวิชาใหม่ = เพิ่มโฟลเดอร์ใหม่ ไม่ต้องแก้โค้ดของระบบ
const fs = require("fs");
const path = require("path");

const COURSES_DIR = path.join(__dirname, "courses");

function loadKnowledge(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^unit(\d+)\.js$/);
    if (m) out[Number(m[1])] = require(path.join(dir, f));
  }
  return out;
}

function fail(code, msg) {
  throw new Error(`[courses] ${code}: ${msg}`);
}

function loadCourse(code) {
  const d = require(path.join(COURSES_DIR, code, "worksheets.js"));
  const { COURSE_CODE, COURSE_INFO, READ_UNITS, WORKSHEETS } = d;
  const GROUP_WORKSHEETS = d.GROUP_WORKSHEETS || [];

  if (COURSE_CODE !== code) fail(code, `COURSE_CODE (${COURSE_CODE}) ต้องตรงกับชื่อโฟลเดอร์`);
  if (!COURSE_INFO || !COURSE_INFO.hubTitle || !COURSE_INFO.shortName) fail(code, "COURSE_INFO ต้องมี shortName และ hubTitle");
  if (!Array.isArray(READ_UNITS) || !READ_UNITS.length) fail(code, "READ_UNITS ว่าง");
  if (!Array.isArray(WORKSHEETS) || !WORKSHEETS.length) fail(code, "WORKSHEETS ว่าง");

  const ids = [...WORKSHEETS, ...GROUP_WORKSHEETS].map(w => w.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) fail(code, `รหัสใบงานซ้ำ: ${dup}`);

  const unitNos = new Set(READ_UNITS.map(u => u.no));
  for (const w of WORKSHEETS) {
    if (!unitNos.has(w.unit)) fail(code, `ใบงาน ${w.id} อ้างหน่วยที่ไม่มี (${w.unit})`);
    if (!Array.isArray(w.steps) || !w.steps.length) fail(code, `ใบงาน ${w.id} ไม่มีขั้นตอน`);
  }

  return {
    code,
    info: COURSE_INFO,
    READ_UNITS,
    WORKSHEETS,
    GROUP_WORKSHEETS,
    ALL_WORKSHEET_IDS: new Set(ids),
    ALL_UNIT_NOS: unitNos,
    ALL_PAIR_WORKSHEET_IDS: new Set(WORKSHEETS.filter(w => w.mode === "pair").map(w => w.id)),
    ALL_GROUP_WORKSHEET_IDS: new Set(GROUP_WORKSHEETS.map(w => w.id)),
    // ขนาดทีมของใบงานกลุ่ม (ตั้งได้ใน COURSE_INFO.group.maxSize; ค่าเริ่มต้น 5)
    TEAM_MAX: Math.max(2, Number((COURSE_INFO.group || {}).maxSize) || 5),
    WORKSHEET_MODE: new Map([
      ...WORKSHEETS.map(w => [w.id, w.mode || "individual"]),
      ...GROUP_WORKSHEETS.map(w => [w.id, "group"]),
    ]),
    knowledge: loadKnowledge(path.join(COURSES_DIR, code, "knowledge")),
  };
}

function loadCourses() {
  const map = new Map();
  for (const code of fs.readdirSync(COURSES_DIR)) {
    if (!fs.existsSync(path.join(COURSES_DIR, code, "worksheets.js"))) continue;
    map.set(code, loadCourse(code));
  }
  if (!map.size) throw new Error("[courses] ไม่พบวิชาใดเลยใน data/courses/");
  return map;
}

module.exports = { loadCourses };
