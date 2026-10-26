const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { MongoClient } = require("mongodb");
const { loadCourses } = require("./data/courses.js");

// โหลดทุกวิชาจาก data/courses/<รหัสวิชา>/ (ตรวจความถูกต้องตอนเริ่มระบบ ถ้าผิดจะหยุดทันที)
const COURSES = loadCourses();

const MAX_SCREENSHOTS = 5;
const MAX_SCREENSHOTS_TOTAL_CHARS = 11 * 1024 * 1024;
const MAX_STEP_ANSWER_LEN = 2000;
const MAX_ANSWER_TEXT_LEN = 10000;
const MAX_STEP_IMAGES = 3;
const MAX_STEP_IMAGE_CHARS = 1500000;
const MAX_STEP_IMAGES_TOTAL_CHARS = 10 * 1024 * 1024;

// allowImages=false สำหรับแบบร่างของคู่ (ไม่ซิงค์ภาพ) / true เฉพาะตอนส่งงานจริง
function sanitizeStepAnswers(input, allowImages = false) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(s => s && Number.isInteger(s.idx) && s.idx >= 0 && s.idx < 50)
    .map(s => {
      const out = {
        idx: s.idx,
        done: !!s.done,
        answer: String(s.answer || "").slice(0, MAX_STEP_ANSWER_LEN),
      };
      if (allowImages && Array.isArray(s.images)) {
        out.images = s.images
          .filter(im => typeof im === "string" && im.startsWith("data:image/") && im.length <= MAX_STEP_IMAGE_CHARS)
          .slice(0, MAX_STEP_IMAGES);
      }
      return out;
    });
}

function computePairKey(courseCode, worksheetId, studentNo, partnerNo) {
  const sorted = [String(studentNo), String(partnerNo)].sort();
  return crypto
    .createHash("sha256")
    .update(`${courseCode}|${worksheetId}|${sorted.join(",")}`)
    .digest("hex")
    .slice(0, 24);
}

// ตัวตนนักเรียน = เลขที่ + ชื่อ (เลขที่อย่างเดียวซ้ำข้ามกลุ่มเรียนได้ เช่น เลขที่ 5 ของ ม.6 กับของ ปกติ)
function uidOf(name, no) {
  return String(no).trim(); // ตัวตน = รหัสนักเรียน (ชื่ออาจสะกดต่างกันได้ จึงไม่รวมในตัวตน)
}
function cleanPerson(src) {
  const name = String((src && src.studentName) || "").trim().replace(/\s+/g, " ").slice(0, 200);
  const no = String((src && src.studentNo) || "").trim().slice(0, 50);
  return name && no ? { name, no, uid: uidOf(name, no) } : null;
}
function findLink(code, worksheetId, uid) {
  return db.collection("pairLinks").findOne({ courseCode: code, worksheetId, uid });
}

function computeTeamKey(courseCode, worksheetId, teamId) {
  return crypto.createHash("sha256").update(`${courseCode}|${worksheetId}|team:${teamId}`).digest("hex").slice(0, 24);
}
// ทีมของนักเรียน 1 คน (ทีมเดียวต่อวิชา ใช้ร่วมกันทุกใบงานกลุ่ม)
function findTeam(code, uid) {
  return db.collection("teams").findOne({ courseCode: code, "members.uid": uid });
}

// ---------- บัญชีนักเรียน / session ----------
const SESSION_DAYS = 30;
const MAX_LOGIN_FAILS = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const loginFails = new Map(); // "username|ip" -> { count, first }

function scryptHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 32, (err, key) => (err ? reject(err) : resolve(key.toString("hex"))));
  });
}
async function makePassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, passwordHash: await scryptHash(password, salt) };
}
async function checkPassword(account, password) {
  const h = await scryptHash(password, account.salt);
  const a = Buffer.from(h, "hex"), b = Buffer.from(account.passwordHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const sha256 = v => crypto.createHash("sha256").update(v).digest("hex");

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}
function setSessionCookie(req, res, token, maxAgeSec) {
  const parts = [`sid=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
  if (req.secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

async function accountFromRequest(req) {
  const token = readCookie(req, "sid");
  if (!token) return null;
  const sess = await db.collection("sessions").findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!sess) return null;
  return db.collection("accounts").findOne({ studentId: sess.studentId });
}

// ต้องล็อกอินก่อน; ตั้ง req.me จาก session (ไม่เชื่อชื่อ/เลขที่ที่ client ส่งมา)
async function requireStudent(req, res, next) {
  try {
    if (!db) return res.status(503).json({ error: "database_unavailable" });
    const acc = await accountFromRequest(req);
    if (!acc) return res.status(401).json({ error: "unauthorized" });
    if (acc.role === "teacher") return res.status(403).json({ error: "teacher_account" });
    req.account = acc;
    req.me = { name: acc.name, no: acc.studentId, uid: uidOf(acc.name, acc.studentId) };
    next();
  } catch (err) {
    console.error("auth error", err);
    res.status(500).json({ error: "server_error" });
  }
}

// ล็อกอินแล้ว (นักเรียนหรือครู) ใช้กับ /api/me และเปลี่ยนรหัสผ่าน
async function requireAccount(req, res, next) {
  try {
    if (!db) return res.status(503).json({ error: "database_unavailable" });
    const acc = await accountFromRequest(req);
    if (!acc) return res.status(401).json({ error: "unauthorized" });
    req.account = acc;
    next();
  } catch (err) {
    console.error("auth error", err);
    res.status(500).json({ error: "server_error" });
  }
}

// ครู = รหัสครู (?key=) หรือล็อกอินด้วยบัญชี role "teacher"
async function isTeacherReq(req) {
  if (req.query.key && req.query.key === TEACHER_KEY) return true;
  const acc = await accountFromRequest(req);
  return !!(acc && acc.role === "teacher");
}

function accountToStudent(a) {
  return { uid: a.studentId, studentName: a.name, studentNo: a.studentId };
}
async function listStudents() {
  const rows = await db.collection("accounts").find({ role: { $ne: "teacher" } }).sort({ studentId: 1 }).limit(1000).toArray();
  return rows.map(accountToStudent);
}
async function findStudent(uid) {
  const a = await db.collection("accounts").findOne({ studentId: String(uid), role: { $ne: "teacher" } });
  return a ? accountToStudent(a) : null;
}

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const TEACHER_KEY = process.env.TEACHER_KEY || "changeme";
// ขนาดสูงสุดของ request body (รองรับภาพหน้าจอ base64 ที่มีขนาดใหญ่กว่าข้อความทั่วไป)
const BODY_LIMIT = "25mb";

const app = express();
app.set("trust proxy", 1); // Render อยู่หลัง proxy (ใช้กับ req.ip / req.secure)
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.static(path.join(__dirname, "public"))); // หน้ารวมวิชา (/) และไฟล์ที่ใช้ร่วมกัน

// รายชื่อวิชาทั้งหมด (ใช้ในหน้ารวมวิชา)
app.get("/api/courses", (req, res) => {
  res.json([...COURSES.values()].map(c => ({
    code: c.code,
    shortName: c.info.shortName,
    fullName: c.info.fullName || "",
    hubTitle: c.info.hubTitle,
    units: c.READ_UNITS.length,
    worksheets: c.WORKSHEETS.length + c.GROUP_WORKSHEETS.length,
    totalHours: c.info.totalHours || null,
  })));
});

// ---------- หน้าเว็บและข้อมูลของแต่ละวิชา: /c/<รหัสวิชา>/ ----------
function loadCourse(req, res, next) {
  const course = COURSES.get(req.params.course);
  if (!course) return res.status(404).json({ error: "course_not_found" });
  req.course = course;
  next();
}

const VIEWS = path.join(__dirname, "views");
// ต้องมี / ต่อท้าย เพราะหน้าเว็บอ้างไฟล์แบบ relative (data.js, learn.html ฯลฯ)
app.get("/c/:course", (req, res, next) => {
  // Express ถือว่า /c/x กับ /c/x/ เป็นเส้นทางเดียวกัน จึงต้องเช็กเองว่ามี / ท้ายอยู่แล้วหรือไม่ ไม่งั้นจะวนรีไดเรกต์ไม่จบ
  if (req.originalUrl.split("?")[0].endsWith("/")) return next();
  res.redirect(301, `/c/${encodeURIComponent(req.params.course)}/`);
});
app.get("/c/:course/", loadCourse, (req, res) => res.sendFile(path.join(VIEWS, "course.html")));
app.get("/c/:course/learn.html", loadCourse, (req, res) => res.sendFile(path.join(VIEWS, "learn.html")));
app.get("/c/:course/teacher.html", loadCourse, (req, res) => res.sendFile(path.join(VIEWS, "teacher.html")));

// ข้อมูลหน่วย/ใบงานของวิชานั้น ให้ฝั่งหน้าเว็บ (ไม่ต้อง copy ข้อมูลซ้ำ)
app.get("/c/:course/data.js", loadCourse, (req, res) => {
  const c = req.course;
  res.type("application/javascript");
  res.send(
    `var COURSE_CODE = ${JSON.stringify(c.code)};\n` +
    `var COURSE_INFO = ${JSON.stringify(c.info)};\n` +
    `var READ_UNITS = ${JSON.stringify(c.READ_UNITS)};\n` +
    `var WORKSHEETS = ${JSON.stringify(c.WORKSHEETS)};\n` +
    `var GROUP_WORKSHEETS = ${JSON.stringify(c.GROUP_WORKSHEETS)};\n`
  );
});

// ใบความรู้รายหน่วย (เนื้อหาเยอะ จึงแยกเป็นไฟล์ต่างหาก โหลดเฉพาะหน้า learn.html)
app.get("/c/:course/knowledge.js", loadCourse, (req, res) => {
  const all = req.course.knowledge;
  const n = Number(req.query.unit);
  const data = n ? (all[n] ? { [n]: all[n] } : {}) : all; // ?unit=N ส่งเฉพาะหน่วยนั้น (ประหยัดการโหลด)
  res.type("application/javascript");
  res.send(`var KNOWLEDGE = ${JSON.stringify(data)};\n`);
});

// ---------- ล็อกอินนักเรียน (username = รหัสนักเรียน) ----------
app.post("/api/login", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "database_unavailable" });
    const username = String((req.body || {}).username || "").trim().slice(0, 50);
    const password = String((req.body || {}).password || "").slice(0, 200);
    if (!username || !password) return res.status(400).json({ error: "missing_fields" });

    const key = username + "|" + req.ip;
    const rec = loginFails.get(key);
    if (rec && Date.now() - rec.first < LOGIN_WINDOW_MS && rec.count >= MAX_LOGIN_FAILS) {
      return res.status(429).json({ error: "too_many_attempts" });
    }

    const acc = await db.collection("accounts").findOne({ studentId: username });
    const ok = acc && await checkPassword(acc, password);
    if (!ok) {
      const fresh = !rec || Date.now() - rec.first >= LOGIN_WINDOW_MS;
      loginFails.set(key, { count: fresh ? 1 : rec.count + 1, first: fresh ? Date.now() : rec.first });
      return res.status(401).json({ error: "invalid_credentials" });
    }
    loginFails.delete(key);

    const token = crypto.randomBytes(32).toString("hex");
    await db.collection("sessions").insertOne({
      tokenHash: sha256(token), studentId: acc.studentId, createdAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
    });
    setSessionCookie(req, res, token, SESSION_DAYS * 86400);
    res.json({ ok: true, name: acc.name, studentId: acc.studentId, role: acc.role || "student", passwordChanged: !!acc.passwordChanged });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ error: "server_error" });
  }
});

app.post("/api/logout", async (req, res) => {
  try {
    const token = readCookie(req, "sid");
    if (token && db) await db.collection("sessions").deleteOne({ tokenHash: sha256(token) });
  } catch (err) { /* ออกจากระบบฝั่ง client ต่อได้ */ }
  setSessionCookie(req, res, "", 0);
  res.json({ ok: true });
});

app.get("/api/me", requireAccount, (req, res) => {
  const a = req.account;
  res.json({ studentId: a.studentId, name: a.name, role: a.role || "student", classGroup: a.classGroup || "", passwordChanged: !!a.passwordChanged });
});

app.post("/api/me/password", requireAccount, async (req, res) => {
  try {
    const oldPassword = String((req.body || {}).oldPassword || "");
    const newPassword = String((req.body || {}).newPassword || "");
    if (newPassword.length < 4 || newPassword.length > 100) return res.status(400).json({ error: "weak_password" });
    if (!(await checkPassword(req.account, oldPassword))) return res.status(403).json({ error: "wrong_password" });
    const pw = await makePassword(newPassword);
    await db.collection("accounts").updateOne({ studentId: req.account.studentId }, { $set: { ...pw, passwordChanged: true } });
    // ออกจากระบบเครื่องอื่นทั้งหมด ยกเว้นเครื่องนี้
    const keep = sha256(readCookie(req, "sid"));
    await db.collection("sessions").deleteMany({ studentId: req.account.studentId, tokenHash: { $ne: keep } });
    res.json({ ok: true });
  } catch (err) {
    console.error("password error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- จัดการรายชื่อ (ใช้รหัสครู) ----------
async function requireTeacher(req, res, next) {
  try {
    if (!db) return res.status(503).json({ error: "database_unavailable" });
    if (!(await isTeacherReq(req))) return res.status(403).json({ error: "forbidden" });
    next();
  } catch (err) {
    console.error("teacher auth error", err);
    res.status(500).json({ error: "server_error" });
  }
}

// นำเข้า/อัปเดตรายชื่อ: body { students: [{ studentId, name, classGroup }] }
// รายชื่อที่มีอยู่แล้วจะอัปเดตชื่อ/ห้อง แต่ไม่แตะรหัสผ่าน; รายชื่อใหม่ได้รหัสผ่านเริ่มต้น = รหัสนักเรียน
app.post("/api/admin/roster", requireTeacher, async (req, res) => {
  try {
    const list = Array.isArray((req.body || {}).students) ? req.body.students : [];
    if (!list.length || list.length > 2000) return res.status(400).json({ error: "invalid_list" });
    const col = db.collection("accounts");
    let created = 0, updated = 0, skipped = 0;
    for (const r of list) {
      const studentId = String((r && r.studentId) || "").trim().slice(0, 50);
      const name = String((r && r.name) || "").trim().replace(/\s+/g, " ").slice(0, 200);
      if (!studentId || !name) { skipped++; continue; }
      const classGroup = String((r && r.classGroup) || "").trim().slice(0, 100);
      const exists = await col.findOne({ studentId });
      if (exists && exists.role === "teacher") { skipped++; continue; }
      if (exists) {
        await col.updateOne({ studentId }, { $set: { name, classGroup } });
        updated++;
      } else {
        const pw = await makePassword(studentId);
        await col.insertOne({ studentId, name, classGroup, ...pw, passwordChanged: false, createdAt: new Date() });
        created++;
      }
    }
    res.json({ ok: true, created, updated, skipped });
  } catch (err) {
    console.error("roster error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// สร้างหรืออัปเดตบัญชีครู: body { username, password, name } (เรียกได้ด้วยรหัสครูหรือบัญชีครู)
app.post("/api/admin/teacher", requireTeacher, async (req, res) => {
  try {
    const username = String((req.body || {}).username || "").trim().slice(0, 50);
    const password = String((req.body || {}).password || "");
    const name = String((req.body || {}).name || username).trim().slice(0, 200);
    if (!username || password.length < 4) return res.status(400).json({ error: "invalid" });
    const exists = await db.collection("accounts").findOne({ studentId: username });
    if (exists && exists.role !== "teacher") return res.status(409).json({ error: "username_is_student" });
    const pw = await makePassword(password);
    await db.collection("accounts").updateOne(
      { studentId: username },
      { $set: { name, role: "teacher", classGroup: "", ...pw, passwordChanged: true }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    await db.collection("sessions").deleteMany({ studentId: username });
    res.json({ ok: true });
  } catch (err) {
    console.error("teacher account error", err);
    res.status(500).json({ error: "server_error" });
  }
});

app.get("/api/admin/accounts", requireTeacher, async (req, res) => {
  const rows = await db.collection("accounts").find({}).project({ studentId: 1, name: 1, classGroup: 1, passwordChanged: 1, role: 1 }).sort({ studentId: 1 }).limit(2000).toArray();
  res.json({ accounts: rows });
});

app.post("/api/admin/reset-password", requireTeacher, async (req, res) => {
  try {
    const studentId = String((req.body || {}).studentId || "").trim();
    const acc = await db.collection("accounts").findOne({ studentId });
    if (!acc) return res.status(404).json({ error: "not_found" });
    const pw = await makePassword(studentId);
    await db.collection("accounts").updateOne({ studentId }, { $set: { ...pw, passwordChanged: false } });
    await db.collection("sessions").deleteMany({ studentId });
    res.json({ ok: true });
  } catch (err) {
    console.error("reset-password error", err);
    res.status(500).json({ error: "server_error" });
  }
});

app.post("/api/admin/delete-account", requireTeacher, async (req, res) => {
  const studentId = String((req.body || {}).studentId || "").trim();
  await db.collection("accounts").deleteOne({ studentId });
  await db.collection("sessions").deleteMany({ studentId });
  res.json({ ok: true });
});

// API ทั้งหมดของวิชาอยู่ใต้ /api/c/<รหัสวิชา>/... (ข้อมูลในฐานข้อมูลแยกด้วยฟิลด์ courseCode)
const router = express.Router({ mergeParams: true });
app.use("/api/c/:course", loadCourse, (req, res, next) => {
  if (req.path.startsWith("/teacher/")) return next();
  requireStudent(req, res, next);
}, router);

let db = null;

async function connectDb() {
  if (!MONGODB_URI) {
    console.warn("[warn] MONGODB_URI is not set — running without database. Submissions will fail.");
    return;
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(); // ใช้ชื่อฐานข้อมูลจาก connection string
  await db.collection("submissions").createIndex({ courseCode: 1, worksheetId: 1 });
  await db.collection("submissions").createIndex({ studentName: 1, studentNo: 1 });
  await db.collection("readMarks").createIndex(
    { courseCode: 1, studentName: 1, studentNo: 1, unitNo: 1 },
    { unique: true }
  );
  await db.collection("drafts").createIndex(
    { courseCode: 1, worksheetId: 1, pairKey: 1 },
    { unique: true }
  );
  await db.collection("students").createIndex({ courseCode: 1, uid: 1 }, { unique: true });
  await db.collection("pairLinks").createIndex({ courseCode: 1, worksheetId: 1, uid: 1 }, { unique: true });
  await db.collection("pairRequests").createIndex({ courseCode: 1, worksheetId: 1, toUid: 1, status: 1 });
  await db.collection("pairRequests").createIndex({ courseCode: 1, worksheetId: 1, fromUid: 1, status: 1 });
  await db.collection("teams").createIndex({ courseCode: 1, "members.uid": 1 });
  await db.collection("teamInvites").createIndex({ courseCode: 1, toUid: 1, status: 1 });
  await db.collection("teamInvites").createIndex({ courseCode: 1, teamId: 1, status: 1 });
  await db.collection("accounts").createIndex({ studentId: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  console.log("[ok] Connected to MongoDB");
}

function requireDb(req, res, next) {
  if (!db) return res.status(503).json({ error: "database_unavailable" });
  next();
}

// ---------- API: ส่งใบงาน ----------
router.post("/submit", requireDb, async (req, res) => {
  try {
    const { worksheetId, answerText, screenshots, screenshotBase64, stepAnswers, partnerName, partnerNo } = req.body || {};
    const studentName = req.me.name, studentNo = req.me.no;

    if (!worksheetId) {
      return res.status(400).json({ error: "missing_fields" });
    }
    if (!req.course.ALL_WORKSHEET_IDS.has(worksheetId)) {
      return res.status(400).json({ error: "invalid_worksheet_id" });
    }

    // รับได้ทั้งรูปแบบใหม่ (screenshots: [...]) และรูปแบบเดิม (screenshotBase64 ไฟล์เดียว)
    let shots = Array.isArray(screenshots) ? screenshots : (screenshotBase64 ? [screenshotBase64] : []);
    shots = shots.filter(s => typeof s === "string" && s.startsWith("data:image/")).slice(0, MAX_SCREENSHOTS);
    if (shots.reduce((sum, s) => sum + s.length, 0) > MAX_SCREENSHOTS_TOTAL_CHARS) {
      return res.status(413).json({ error: "screenshot_too_large" });
    }

    const cleanSteps = sanitizeStepAnswers(stepAnswers, true);
    const stepImagesChars = cleanSteps.reduce(
      (sum, s) => sum + (s.images || []).reduce((a, im) => a + im.length, 0), 0);
    if (stepImagesChars > MAX_STEP_IMAGES_TOTAL_CHARS) {
      return res.status(413).json({ error: "step_images_too_large" });
    }

    const mode = req.course.WORKSHEET_MODE.get(worksheetId) || "individual";

    // ใบงานคู่: ใช้คู่ที่ยืนยันแล้วจากระบบ (ไม่เชื่อค่าที่เบราว์เซอร์ส่งมา)
    let pName = partnerName, pNo = partnerNo;
    if (mode === "pair") {
      const me = req.me;
      const link = me && await findLink(req.course.code, worksheetId, me.uid);
      if (link) { pName = link.partnerName; pNo = link.partnerNo; }
    }

    // ใบงานกลุ่ม: ต้องมีทีมแล้ว ใช้ข้อมูลทีมจากระบบ (ไม่เชื่อค่าที่เบราว์เซอร์ส่งมา)
    let team = null;
    if (mode === "group") {
      const me = req.me;
      team = me && await findTeam(req.course.code, me.uid);
      if (!team) return res.status(400).json({ error: "not_in_team" });
    }

    const doc = {
      courseCode: req.course.code,
      studentName: String(studentName).trim().slice(0, 200),
      studentNo: String(studentNo).trim().slice(0, 50),
      worksheetId,
      answerText: String(answerText || "").slice(0, MAX_ANSWER_TEXT_LEN),
      screenshots: shots,
      mode,
      stepAnswers: cleanSteps,
      partnerName: mode === "pair" && pName ? String(pName).trim().slice(0, 200) : null,
      partnerNo: mode === "pair" && pNo ? String(pNo).trim().slice(0, 50) : null,
      teamId: team ? String(team._id) : null,
      teamName: team ? team.name : null,
      teamMembers: team ? team.members.map(m => ({ studentName: m.name, studentNo: m.no })) : null,
      submittedAt: new Date(),
    };

    const result = await db.collection("submissions").insertOne(doc);
    res.json({ ok: true, id: result.insertedId });
  } catch (err) {
    console.error("submit error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- API: ขอจับคู่ทำใบงานคู่ (ส่งคำขอ → เพื่อนยืนยัน → เป็นคู่) ----------
function pairWorksheetOr400(req, res, src) {
  const worksheetId = src.worksheetId;
  if (!req.course.ALL_PAIR_WORKSHEET_IDS.has(worksheetId)) {
    res.status(400).json({ error: "not_pair_worksheet" });
    return null;
  }
  const me = req.me;
  if (!me) {
    res.status(400).json({ error: "missing_fields" });
    return null;
  }
  return { worksheetId, me };
}

// ลงทะเบียนชื่อนักเรียนไว้ เพื่อให้เพื่อนค้นหาเจอตอนขอจับคู่
// รายชื่อมาจากบัญชีที่ครูนำเข้า ไม่ต้องลงทะเบียนเอง (คงเส้นทางไว้ให้หน้าเว็บรุ่นเก่า)
router.post("/students/register", (req, res) => res.json({ ok: true }));

// สถานะการจับคู่ของฉัน: มีคู่แล้วหรือยัง / คำขอที่เข้ามา / คำขอที่ฉันส่งไป
router.get("/pair/state", requireDb, async (req, res) => {
  try {
    const ctx = pairWorksheetOr400(req, res, req.query);
    if (!ctx) return;
    const { worksheetId, me } = ctx;
    const link = await findLink(req.course.code, worksheetId, me.uid);
    if (link) return res.json({ partner: { name: link.partnerName, no: link.partnerNo } });

    const reqs = db.collection("pairRequests");
    const incoming = await reqs.find({ courseCode: req.course.code, worksheetId, toUid: me.uid, status: "pending" }).sort({ createdAt: 1 }).toArray();
    const outgoing = await reqs.find({ courseCode: req.course.code, worksheetId, fromUid: me.uid, status: "pending" }).sort({ createdAt: 1 }).toArray();
    res.json({
      partner: null,
      incoming: incoming.map(r => ({ id: String(r._id), name: r.fromName, no: r.fromNo })),
      outgoing: outgoing.map(r => ({ id: String(r._id), name: r.toName, no: r.toNo })),
    });
  } catch (err) {
    console.error("pair state error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// รายชื่อเพื่อนที่ "ยังว่าง" (ยังไม่มีคู่ในใบงานนี้) ให้เลือกส่งคำขอ
router.get("/pair/candidates", requireDb, async (req, res) => {
  try {
    const ctx = pairWorksheetOr400(req, res, req.query);
    if (!ctx) return;
    const { worksheetId, me } = ctx;
    if (await findLink(req.course.code, worksheetId, me.uid)) return res.json({ candidates: [] });

    const q = String(req.query.q || "").trim().toLowerCase();
    const [students, links, outgoing, incoming] = await Promise.all([
      listStudents(),
      db.collection("pairLinks").find({ courseCode: req.course.code, worksheetId }).project({ uid: 1 }).toArray(),
      db.collection("pairRequests").find({ courseCode: req.course.code, worksheetId, fromUid: me.uid, status: "pending" }).toArray(),
      db.collection("pairRequests").find({ courseCode: req.course.code, worksheetId, toUid: me.uid, status: "pending" }).toArray(),
    ]);
    const taken = new Set(links.map(l => l.uid));
    const sentTo = new Set(outgoing.map(r => r.toUid));
    const gotFrom = new Set(incoming.map(r => r.fromUid));

    const candidates = students
      .filter(s => s.uid !== me.uid && !taken.has(s.uid))
      .filter(s => !q || s.studentName.toLowerCase().includes(q) || s.studentNo.toLowerCase() === q)
      .slice(0, 60)
      .map(s => ({
        name: s.studentName, no: s.studentNo,
        state: sentTo.has(s.uid) ? "requested" : gotFrom.has(s.uid) ? "incoming" : "none",
      }));
    res.json({ candidates });
  } catch (err) {
    console.error("pair candidates error", err);
    res.status(500).json({ error: "server_error" });
  }
});

async function createPair(code, worksheetId, a, b) {
  const links = db.collection("pairLinks");
  const base = { courseCode: code, worksheetId, createdAt: new Date() };
  try {
    await links.insertOne({ ...base, uid: a.uid, partnerUid: b.uid, partnerName: b.name, partnerNo: b.no });
    await links.insertOne({ ...base, uid: b.uid, partnerUid: a.uid, partnerName: a.name, partnerNo: a.no });
  } catch (err) {
    // มีใครจับคู่ไปก่อนในเสี้ยววินาทีเดียวกัน → ถอนที่เพิ่งสร้างแล้วแจ้งว่าไม่ว่าง
    await links.deleteMany({ courseCode: code, worksheetId, uid: { $in: [a.uid, b.uid] }, createdAt: base.createdAt });
    return false;
  }
  // คำขอที่ค้างของทั้งสองคนในใบงานนี้ถือว่าจบ
  await db.collection("pairRequests").updateMany(
    {
      courseCode: code, worksheetId, status: "pending",
      $or: [{ fromUid: { $in: [a.uid, b.uid] } }, { toUid: { $in: [a.uid, b.uid] } }],
    },
    { $set: { status: "closed", closedAt: new Date() } }
  );
  return true;
}

router.post("/pair/request", requireDb, async (req, res) => {
  try {
    const ctx = pairWorksheetOr400(req, res, req.body || {});
    if (!ctx) return;
    const { worksheetId, me } = ctx;
    const to = cleanPerson({ studentName: req.body.toName, studentNo: req.body.toNo });
    if (!to || to.uid === me.uid) return res.status(400).json({ error: "invalid_target" });

    const target = await findStudent(to.uid);
    if (!target) return res.status(404).json({ error: "student_not_found" });
    if ((await findLink(req.course.code, worksheetId, me.uid)) || (await findLink(req.course.code, worksheetId, to.uid))) {
      return res.status(409).json({ error: "already_paired" });
    }

    const reqs = db.collection("pairRequests");
    // อีกฝ่ายส่งคำขอมาหาเราอยู่แล้ว → ถือว่าตกลงกันเลย
    const reverse = await reqs.findOne({ courseCode: req.course.code, worksheetId, fromUid: to.uid, toUid: me.uid, status: "pending" });
    if (reverse) {
      const ok = await createPair(req.course.code, worksheetId, me, to);
      return ok ? res.json({ ok: true, paired: true }) : res.status(409).json({ error: "already_paired" });
    }
    const dup = await reqs.findOne({ courseCode: req.course.code, worksheetId, fromUid: me.uid, toUid: to.uid, status: "pending" });
    if (!dup) {
      await reqs.insertOne({
        courseCode: req.course.code, worksheetId, status: "pending", createdAt: new Date(),
        fromUid: me.uid, fromName: me.name, fromNo: me.no,
        toUid: to.uid, toName: target.studentName, toNo: target.studentNo,
      });
    }
    res.json({ ok: true, paired: false });
  } catch (err) {
    console.error("pair request error", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/pair/respond", requireDb, async (req, res) => {
  try {
    const me = req.me;
    const { requestId, action } = req.body || {};
    if (!me || !requestId || !["accept", "decline"].includes(action)) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const { ObjectId } = require("mongodb");
    const reqs = db.collection("pairRequests");
    const r = await reqs.findOne({ _id: new ObjectId(requestId), courseCode: req.course.code, toUid: me.uid, status: "pending" });
    if (!r) return res.status(404).json({ error: "request_not_found" });

    if (action === "decline") {
      await reqs.updateOne({ _id: r._id }, { $set: { status: "declined", closedAt: new Date() } });
      return res.json({ ok: true });
    }
    if ((await findLink(req.course.code, r.worksheetId, me.uid)) || (await findLink(req.course.code, r.worksheetId, r.fromUid))) {
      await reqs.updateOne({ _id: r._id }, { $set: { status: "closed", closedAt: new Date() } });
      return res.status(409).json({ error: "already_paired" });
    }
    const from = { uid: r.fromUid, name: r.fromName, no: r.fromNo };
    const ok = await createPair(req.course.code, r.worksheetId, me, from);
    res.status(ok ? 200 : 409).json(ok ? { ok: true, paired: true } : { error: "already_paired" });
  } catch (err) {
    console.error("pair respond error", err);
    res.status(400).json({ error: "bad_request" });
  }
});

router.post("/pair/cancel", requireDb, async (req, res) => {
  try {
    const me = req.me;
    const { requestId } = req.body || {};
    if (!me || !requestId) return res.status(400).json({ error: "missing_fields" });
    const { ObjectId } = require("mongodb");
    await db.collection("pairRequests").updateOne(
      { _id: new ObjectId(requestId), courseCode: req.course.code, fromUid: me.uid, status: "pending" },
      { $set: { status: "cancelled", closedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "bad_request" });
  }
});

// ยกเลิกการจับคู่ (ทำได้ทั้งสองฝ่าย) แบบร่างเดิมยังอยู่ ถ้าจับคู่กับคนเดิมอีกจะเห็นข้อมูลเดิม
router.post("/pair/unpair", requireDb, async (req, res) => {
  try {
    const ctx = pairWorksheetOr400(req, res, req.body || {});
    if (!ctx) return;
    const { worksheetId, me } = ctx;
    const link = await findLink(req.course.code, worksheetId, me.uid);
    if (link) {
      await db.collection("pairLinks").deleteMany({
        courseCode: req.course.code, worksheetId, uid: { $in: [me.uid, link.partnerUid] },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("unpair error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- API: ทีมสำหรับใบงานกลุ่ม (สร้างทีม → เชิญเพื่อน → เพื่อนยืนยัน) ----------
// 1 คนมี 1 ทีมต่อวิชา ใช้ร่วมกันทุกใบงานกลุ่ม ขนาดสูงสุด req.course.TEAM_MAX
function teamView(t) {
  return { id: String(t._id), name: t.name, members: t.members.map(m => ({ name: m.name, no: m.no })) };
}

router.get("/team/state", requireDb, async (req, res) => {
  try {
    const me = req.me;
    if (!me) return res.status(400).json({ error: "missing_fields" });
    const team = await findTeam(req.course.code, me.uid);
    const invites = db.collection("teamInvites");
    if (team) {
      const out = await invites.find({ courseCode: req.course.code, teamId: String(team._id), status: "pending" }).toArray();
      return res.json({
        max: req.course.TEAM_MAX,
        team: teamView(team),
        outgoing: out.map(r => ({ id: String(r._id), name: r.toName, no: r.toNo })),
      });
    }
    const incoming = await invites.find({ courseCode: req.course.code, toUid: me.uid, status: "pending" }).sort({ createdAt: 1 }).toArray();
    res.json({
      max: req.course.TEAM_MAX,
      team: null,
      incoming: incoming.map(r => ({ id: String(r._id), teamName: r.teamName, fromName: r.fromName, fromNo: r.fromNo })),
    });
  } catch (err) {
    console.error("team state error", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/team/create", requireDb, async (req, res) => {
  try {
    const me = req.me;
    const name = String((req.body || {}).teamName || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!me || !name) return res.status(400).json({ error: "missing_fields" });
    if (await findTeam(req.course.code, me.uid)) return res.status(409).json({ error: "already_in_team" });
    await db.collection("teams").insertOne({
      courseCode: req.course.code, name, createdAt: new Date(),
      members: [{ uid: me.uid, name: me.name, no: me.no }],
    });
    await db.collection("teamInvites").updateMany(
      { courseCode: req.course.code, toUid: me.uid, status: "pending" },
      { $set: { status: "closed", closedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("team create error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// เพื่อนที่ยังไม่มีทีม ให้เชิญเข้าทีม
router.get("/team/candidates", requireDb, async (req, res) => {
  try {
    const me = req.me;
    if (!me) return res.status(400).json({ error: "missing_fields" });
    const team = await findTeam(req.course.code, me.uid);
    if (!team) return res.json({ candidates: [] });
    const q = String(req.query.q || "").trim().toLowerCase();
    const [students, teams, pending] = await Promise.all([
      listStudents(),
      db.collection("teams").find({ courseCode: req.course.code }).project({ members: 1 }).toArray(),
      db.collection("teamInvites").find({ courseCode: req.course.code, teamId: String(team._id), status: "pending" }).toArray(),
    ]);
    const taken = new Set(teams.flatMap(t => t.members.map(m => m.uid)));
    const invited = new Set(pending.map(r => r.toUid));
    const candidates = students
      .filter(s => !taken.has(s.uid))
      .filter(s => !q || s.studentName.toLowerCase().includes(q) || s.studentNo.toLowerCase() === q)
      .slice(0, 60)
      .map(s => ({ name: s.studentName, no: s.studentNo, state: invited.has(s.uid) ? "invited" : "none" }));
    res.json({ candidates });
  } catch (err) {
    console.error("team candidates error", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/team/invite", requireDb, async (req, res) => {
  try {
    const me = req.me;
    const to = cleanPerson({ studentName: (req.body || {}).toName, studentNo: (req.body || {}).toNo });
    if (!me || !to || to.uid === me.uid) return res.status(400).json({ error: "invalid_target" });
    const team = await findTeam(req.course.code, me.uid);
    if (!team) return res.status(403).json({ error: "not_in_team" });
    if (team.members.length >= req.course.TEAM_MAX) return res.status(409).json({ error: "team_full" });
    const target = await findStudent(to.uid);
    if (!target) return res.status(404).json({ error: "student_not_found" });
    if (await findTeam(req.course.code, to.uid)) return res.status(409).json({ error: "already_in_team" });
    const invites = db.collection("teamInvites");
    const dup = await invites.findOne({ courseCode: req.course.code, teamId: String(team._id), toUid: to.uid, status: "pending" });
    if (!dup) {
      await invites.insertOne({
        courseCode: req.course.code, teamId: String(team._id), teamName: team.name, status: "pending", createdAt: new Date(),
        fromUid: me.uid, fromName: me.name, fromNo: me.no,
        toUid: to.uid, toName: target.studentName, toNo: target.studentNo,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("team invite error", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/team/respond", requireDb, async (req, res) => {
  try {
    const me = req.me;
    const { requestId, action } = req.body || {};
    if (!me || !requestId || !["accept", "decline"].includes(action)) return res.status(400).json({ error: "missing_fields" });
    const { ObjectId } = require("mongodb");
    const invites = db.collection("teamInvites");
    const r = await invites.findOne({ _id: new ObjectId(requestId), courseCode: req.course.code, toUid: me.uid, status: "pending" });
    if (!r) return res.status(404).json({ error: "request_not_found" });
    if (action === "decline") {
      await invites.updateOne({ _id: r._id }, { $set: { status: "declined", closedAt: new Date() } });
      return res.json({ ok: true });
    }
    if (await findTeam(req.course.code, me.uid)) {
      await invites.updateOne({ _id: r._id }, { $set: { status: "closed", closedAt: new Date() } });
      return res.status(409).json({ error: "already_in_team" });
    }
    // เพิ่มเข้าทีมแบบ atomic: เงื่อนไขขนาดทีมอยู่ใน filter กันเกินจำนวนเมื่อหลายคนกดพร้อมกัน
    const upd = await db.collection("teams").updateOne(
      { _id: new ObjectId(r.teamId), courseCode: req.course.code, "members.uid": { $ne: me.uid }, ["members." + (req.course.TEAM_MAX - 1)]: { $exists: false } },
      { $push: { members: { uid: me.uid, name: me.name, no: me.no } } }
    );
    if (!upd.modifiedCount) {
      await invites.updateOne({ _id: r._id }, { $set: { status: "closed", closedAt: new Date() } });
      return res.status(409).json({ error: "team_full" });
    }
    await invites.updateMany(
      { courseCode: req.course.code, toUid: me.uid, status: "pending" },
      { $set: { status: "closed", closedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("team respond error", err);
    res.status(400).json({ error: "bad_request" });
  }
});

router.post("/team/cancel", requireDb, async (req, res) => {
  try {
    const me = req.me;
    const { requestId } = req.body || {};
    if (!me || !requestId) return res.status(400).json({ error: "missing_fields" });
    const team = await findTeam(req.course.code, me.uid);
    if (!team) return res.json({ ok: true });
    const { ObjectId } = require("mongodb");
    await db.collection("teamInvites").updateOne(
      { _id: new ObjectId(requestId), courseCode: req.course.code, teamId: String(team._id), status: "pending" },
      { $set: { status: "cancelled", closedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "bad_request" });
  }
});

// ออกจากทีม (ถ้าเป็นคนสุดท้าย ทีมถูกลบ แบบร่างยังเก็บไว้ในฐานข้อมูล)
router.post("/team/leave", requireDb, async (req, res) => {
  try {
    const me = req.me;
    if (!me) return res.status(400).json({ error: "missing_fields" });
    const team = await findTeam(req.course.code, me.uid);
    if (team) {
      await db.collection("teams").updateOne({ _id: team._id }, { $pull: { members: { uid: me.uid } } });
      await db.collection("teams").deleteOne({ _id: team._id, members: { $size: 0 } });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("team leave error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- API: แชร์แบบร่างระหว่างคู่ (เฉพาะใบงาน mode==="pair") ----------
router.get("/draft/:worksheetId", requireDb, async (req, res) => {
  try {
    const { worksheetId } = req.params;

    const isGroup = req.course.ALL_GROUP_WORKSHEET_IDS.has(worksheetId);
    if (!isGroup && !req.course.ALL_PAIR_WORKSHEET_IDS.has(worksheetId)) {
      return res.status(400).json({ error: "not_pair_worksheet" });
    }
    const me = req.me;
    if (!me) {
      return res.status(400).json({ error: "missing_fields" });
    }

    let pairKey, existingSubmission;
    if (isGroup) {
      const team = await findTeam(req.course.code, me.uid);
      if (!team) return res.status(403).json({ error: "not_paired" });
      pairKey = computeTeamKey(req.course.code, worksheetId, String(team._id));
      existingSubmission = await db.collection("submissions")
        .find({ courseCode: req.course.code, worksheetId, teamId: String(team._id) })
        .sort({ submittedAt: -1 }).limit(1).next();
    } else {
      const link = await findLink(req.course.code, worksheetId, me.uid);
      if (!link) {
        return res.status(403).json({ error: "not_paired" });
      }
      pairKey = computePairKey(req.course.code, worksheetId, me.uid, link.partnerUid);

      // งานนี้ส่งไปแล้วโดยคนใดคนหนึ่งในคู่หรือไม่ (เทียบด้วย เลขที่+ชื่อ ของทั้งสองคน)
      const candidates = await db.collection("submissions")
        .find({
          courseCode: req.course.code,
          worksheetId,
          $or: [
            { studentNo: me.no }, { studentNo: link.partnerNo },
            { partnerNo: me.no }, { partnerNo: link.partnerNo },
          ],
        })
        .sort({ submittedAt: -1 })
        .limit(20)
        .toArray();
      const pairUids = new Set([me.uid, link.partnerUid]);
      existingSubmission = candidates.find(s =>
        pairUids.has(uidOf(s.studentName, s.studentNo)) ||
        (s.partnerNo && pairUids.has(uidOf(s.partnerName || "", s.partnerNo)))
      );
    }
    const draft = await db.collection("drafts").findOne({ courseCode: req.course.code, worksheetId, pairKey });

    if (!draft) {
      return res.json({
        exists: false,
        alreadySubmitted: !!existingSubmission,
        submittedBy: existingSubmission ? existingSubmission.studentName : null,
        submittedAt: existingSubmission ? existingSubmission.submittedAt : null,
      });
    }

    res.json({
      exists: true,
      stepAnswers: draft.stepAnswers || [],
      answerText: draft.answerText || "",
      answerTextUpdatedAt: draft.answerTextUpdatedAt || null,
      answerTextUpdatedBy: draft.answerTextUpdatedBy || null,
      members: draft.members || [],
      updatedAt: draft.updatedAt || null,
      alreadySubmitted: !!existingSubmission,
      submittedBy: existingSubmission ? existingSubmission.studentName : null,
      submittedAt: existingSubmission ? existingSubmission.submittedAt : null,
    });
  } catch (err) {
    console.error("draft get error", err);
    res.status(500).json({ error: "server_error" });
  }
});

router.put("/draft/:worksheetId", requireDb, async (req, res) => {
  try {
    const { worksheetId } = req.params;
    const { stepAnswers, answerText } = req.body || {};

    const isGroup = req.course.ALL_GROUP_WORKSHEET_IDS.has(worksheetId);
    if (!isGroup && !req.course.ALL_PAIR_WORKSHEET_IDS.has(worksheetId)) {
      return res.status(400).json({ error: "not_pair_worksheet" });
    }
    const me = req.me;
    if (!me) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const studentName = me.name, studentNo = me.no;

    let pairKey;
    if (isGroup) {
      const team = await findTeam(req.course.code, me.uid);
      if (!team) return res.status(403).json({ error: "not_paired" });
      pairKey = computeTeamKey(req.course.code, worksheetId, String(team._id));
    } else {
      const link = await findLink(req.course.code, worksheetId, me.uid);
      if (!link) {
        return res.status(403).json({ error: "not_paired" });
      }
      pairKey = computePairKey(req.course.code, worksheetId, me.uid, link.partnerUid);
    }
    const now = new Date();
    const col = db.collection("drafts");

    const existing = await col.findOne({ courseCode: req.course.code, worksheetId, pairKey });

    // รวม stepAnswers เดิมกับของใหม่ (merge ทีละ idx ไม่ทับทั้งอาร์เรย์)
    let mergedSteps = existing ? (existing.stepAnswers || []) : [];
    if (Array.isArray(stepAnswers)) {
      const incoming = sanitizeStepAnswers(stepAnswers);
      for (const inc of incoming) {
        const i = mergedSteps.findIndex(s => s.idx === inc.idx);
        const entry = { idx: inc.idx, done: inc.done, answer: inc.answer, updatedAt: now, updatedBy: String(studentNo) };
        if (i >= 0) mergedSteps[i] = entry; else mergedSteps.push(entry);
      }
    }

    const members = existing ? (existing.members || []) : [];
    if (!members.some(m => uidOf(m.studentName, m.studentNo) === me.uid)) {
      members.push({ studentName: me.name, studentNo: me.no });
    }

    const update = {
      courseCode: req.course.code,
      worksheetId,
      pairKey,
      members,
      stepAnswers: mergedSteps,
      updatedAt: now,
    };
    if (typeof answerText === "string") {
      update.answerText = answerText.slice(0, MAX_ANSWER_TEXT_LEN);
      update.answerTextUpdatedAt = now;
      update.answerTextUpdatedBy = String(studentNo);
    } else if (existing) {
      update.answerText = existing.answerText || "";
      update.answerTextUpdatedAt = existing.answerTextUpdatedAt || null;
      update.answerTextUpdatedBy = existing.answerTextUpdatedBy || null;
    }
    if (!existing) update.createdAt = now;

    await col.updateOne(
      { courseCode: req.course.code, worksheetId, pairKey },
      { $set: update },
      { upsert: true }
    );

    res.json({ ok: true, updatedAt: now });
  } catch (err) {
    console.error("draft put error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- API: มาร์กว่าอ่านแล้ว ----------
router.post("/read", requireDb, async (req, res) => {
  try {
    const { unitNo } = req.body || {};
    const studentName = req.me.name, studentNo = req.me.no;
    const unitNum = Number(unitNo);

    if (!studentName || !studentNo || !req.course.ALL_UNIT_NOS.has(unitNum)) {
      return res.status(400).json({ error: "missing_or_invalid_fields" });
    }

    await db.collection("readMarks").updateOne(
      { courseCode: req.course.code, studentName: String(studentName).trim(), studentNo: String(studentNo).trim(), unitNo: unitNum },
      { $set: { readAt: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("read-mark error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- API: มุมมองครู — ดึงข้อมูลสรุป ----------
router.get("/teacher/data", requireDb, async (req, res) => {
  if (!(await isTeacherReq(req))) {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const submissions = await db
      .collection("submissions")
      .find({ courseCode: req.course.code })
      .project({
        studentName: 1, studentNo: 1, worksheetId: 1, answerText: 1, submittedAt: 1,
        mode: 1, partnerName: 1, partnerNo: 1, teamName: 1, teamMembers: 1,
        stepAnswers: {
          $map: {
            input: { $ifNull: ["$stepAnswers", []] },
            as: "s",
            in: {
              idx: "$$s.idx", done: "$$s.done", answer: "$$s.answer",
              imageCount: { $size: { $ifNull: ["$$s.images", []] } },
            },
          },
        },
        screenshotCount: {
          $add: [
            { $size: { $ifNull: ["$screenshots", []] } },
            { $cond: [{ $ifNull: ["$screenshotBase64", false] }, 1, 0] },
          ],
        },
      })
      .sort({ submittedAt: -1 })
      .limit(2000)
      .toArray();
    const readMarks = await db
      .collection("readMarks")
      .find({ courseCode: req.course.code })
      .project({ studentName: 1, studentNo: 1, unitNo: 1, readAt: 1 })
      .toArray();
    res.json({ submissions, readMarks });
  } catch (err) {
    console.error("teacher data error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- API: มุมมองครู — ดูภาพหน้าจอรายการเดียว ----------
router.get("/teacher/screenshot/:id", requireDb, async (req, res) => {
  if (!(await isTeacherReq(req))) {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const { ObjectId } = require("mongodb");
    const doc = await db.collection("submissions").findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).end();
    const all = [...(doc.screenshots || []), ...(doc.screenshotBase64 ? [doc.screenshotBase64] : [])];
    const img = all[Number(req.query.i) || 0];
    if (!img) return res.status(404).end();
    res.json({ screenshotBase64: img });
  } catch (err) {
    res.status(400).json({ error: "bad_request" });
  }
});

// ---------- API: มุมมองครู — ดูภาพของขั้นตอนปฏิบัติ ----------
router.get("/teacher/step-image/:id", requireDb, async (req, res) => {
  if (!(await isTeacherReq(req))) {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const { ObjectId } = require("mongodb");
    const doc = await db.collection("submissions").findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).end();
    const step = (doc.stepAnswers || []).find(s => s.idx === Number(req.query.step));
    const img = step && (step.images || [])[Number(req.query.i) || 0];
    if (!img) return res.status(404).end();
    res.json({ image: img });
  } catch (err) {
    res.status(400).json({ error: "bad_request" });
  }
});

app.get("/healthz", (req, res) => res.json({ ok: true, db: !!db }));

app.listen(PORT, async () => {
  console.log(`DevOps worksheet system listening on port ${PORT}`);
  await connectDb();
});
