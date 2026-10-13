const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { MongoClient } = require("mongodb");
const { COURSE_CODE, READ_UNITS, WORKSHEETS, GROUP_WORKSHEETS, ALL_WORKSHEET_IDS, ALL_UNIT_NOS, ALL_PAIR_WORKSHEET_IDS } = require("./data/worksheets.js");

// worksheetId -> "individual" | "pair" เผื่อ validate/บันทึกตอนส่งงาน
const WORKSHEET_MODE = new Map(WORKSHEETS.map(w => [w.id, w.mode || "individual"]));

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
  return String(no).trim() + "|" + String(name).trim().replace(/\s+/g, " ").toLowerCase();
}
function cleanPerson(src) {
  const name = String((src && src.studentName) || "").trim().replace(/\s+/g, " ").slice(0, 200);
  const no = String((src && src.studentNo) || "").trim().slice(0, 50);
  return name && no ? { name, no, uid: uidOf(name, no) } : null;
}
function findLink(worksheetId, uid) {
  return db.collection("pairLinks").findOne({ courseCode: COURSE_CODE, worksheetId, uid });
}

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const TEACHER_KEY = process.env.TEACHER_KEY || "changeme";
// ขนาดสูงสุดของ request body (รองรับภาพหน้าจอ base64 ที่มีขนาดใหญ่กว่าข้อความทั่วไป)
const BODY_LIMIT = "25mb";

const app = express();
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.static(path.join(__dirname, "public")));

// เสิร์ฟข้อมูลหน่วย/ใบงานให้ฝั่งหน้าเว็บ จาก data/worksheets.js ไฟล์เดียว (ไม่ต้อง copy ข้อมูลซ้ำ)
app.get("/data.js", (req, res) => {
  res.type("application/javascript");
  res.send(
    `const READ_UNITS = ${JSON.stringify(READ_UNITS)};\n` +
    `const WORKSHEETS = ${JSON.stringify(WORKSHEETS)};\n` +
    `const GROUP_WORKSHEETS = ${JSON.stringify(GROUP_WORKSHEETS)};\n`
  );
});

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
  console.log("[ok] Connected to MongoDB");
}

function requireDb(req, res, next) {
  if (!db) return res.status(503).json({ error: "database_unavailable" });
  next();
}

// ---------- API: ส่งใบงาน ----------
app.post("/api/submit", requireDb, async (req, res) => {
  try {
    const { studentName, studentNo, worksheetId, answerText, screenshots, screenshotBase64, stepAnswers, partnerName, partnerNo } = req.body || {};

    if (!studentName || !studentNo || !worksheetId) {
      return res.status(400).json({ error: "missing_fields" });
    }
    if (!ALL_WORKSHEET_IDS.has(worksheetId)) {
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

    const mode = WORKSHEET_MODE.get(worksheetId) || "individual";

    // ใบงานคู่: ใช้คู่ที่ยืนยันแล้วจากระบบ (ไม่เชื่อค่าที่เบราว์เซอร์ส่งมา)
    let pName = partnerName, pNo = partnerNo;
    if (mode === "pair") {
      const me = cleanPerson(req.body);
      const link = me && await findLink(worksheetId, me.uid);
      if (link) { pName = link.partnerName; pNo = link.partnerNo; }
    }

    const doc = {
      courseCode: COURSE_CODE,
      studentName: String(studentName).trim().slice(0, 200),
      studentNo: String(studentNo).trim().slice(0, 50),
      worksheetId,
      answerText: String(answerText || "").slice(0, MAX_ANSWER_TEXT_LEN),
      screenshots: shots,
      mode,
      stepAnswers: cleanSteps,
      partnerName: mode === "pair" && pName ? String(pName).trim().slice(0, 200) : null,
      partnerNo: mode === "pair" && pNo ? String(pNo).trim().slice(0, 50) : null,
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
  if (!ALL_PAIR_WORKSHEET_IDS.has(worksheetId)) {
    res.status(400).json({ error: "not_pair_worksheet" });
    return null;
  }
  const me = cleanPerson(src);
  if (!me) {
    res.status(400).json({ error: "missing_fields" });
    return null;
  }
  return { worksheetId, me };
}

// ลงทะเบียนชื่อนักเรียนไว้ เพื่อให้เพื่อนค้นหาเจอตอนขอจับคู่
app.post("/api/students/register", requireDb, async (req, res) => {
  try {
    const p = cleanPerson(req.body);
    if (!p) return res.status(400).json({ error: "missing_fields" });
    await db.collection("students").updateOne(
      { courseCode: COURSE_CODE, uid: p.uid },
      { $set: { studentName: p.name, studentNo: p.no, lastSeenAt: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("register error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// สถานะการจับคู่ของฉัน: มีคู่แล้วหรือยัง / คำขอที่เข้ามา / คำขอที่ฉันส่งไป
app.get("/api/pair/state", requireDb, async (req, res) => {
  try {
    const ctx = pairWorksheetOr400(req, res, req.query);
    if (!ctx) return;
    const { worksheetId, me } = ctx;
    const link = await findLink(worksheetId, me.uid);
    if (link) return res.json({ partner: { name: link.partnerName, no: link.partnerNo } });

    const reqs = db.collection("pairRequests");
    const incoming = await reqs.find({ courseCode: COURSE_CODE, worksheetId, toUid: me.uid, status: "pending" }).sort({ createdAt: 1 }).toArray();
    const outgoing = await reqs.find({ courseCode: COURSE_CODE, worksheetId, fromUid: me.uid, status: "pending" }).sort({ createdAt: 1 }).toArray();
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
app.get("/api/pair/candidates", requireDb, async (req, res) => {
  try {
    const ctx = pairWorksheetOr400(req, res, req.query);
    if (!ctx) return;
    const { worksheetId, me } = ctx;
    if (await findLink(worksheetId, me.uid)) return res.json({ candidates: [] });

    const q = String(req.query.q || "").trim().toLowerCase();
    const [students, links, outgoing, incoming] = await Promise.all([
      db.collection("students").find({ courseCode: COURSE_CODE }).sort({ studentNo: 1 }).limit(1000).toArray(),
      db.collection("pairLinks").find({ courseCode: COURSE_CODE, worksheetId }).project({ uid: 1 }).toArray(),
      db.collection("pairRequests").find({ courseCode: COURSE_CODE, worksheetId, fromUid: me.uid, status: "pending" }).toArray(),
      db.collection("pairRequests").find({ courseCode: COURSE_CODE, worksheetId, toUid: me.uid, status: "pending" }).toArray(),
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

async function createPair(worksheetId, a, b) {
  const links = db.collection("pairLinks");
  const base = { courseCode: COURSE_CODE, worksheetId, createdAt: new Date() };
  try {
    await links.insertOne({ ...base, uid: a.uid, partnerUid: b.uid, partnerName: b.name, partnerNo: b.no });
    await links.insertOne({ ...base, uid: b.uid, partnerUid: a.uid, partnerName: a.name, partnerNo: a.no });
  } catch (err) {
    // มีใครจับคู่ไปก่อนในเสี้ยววินาทีเดียวกัน → ถอนที่เพิ่งสร้างแล้วแจ้งว่าไม่ว่าง
    await links.deleteMany({ courseCode: COURSE_CODE, worksheetId, uid: { $in: [a.uid, b.uid] }, createdAt: base.createdAt });
    return false;
  }
  // คำขอที่ค้างของทั้งสองคนในใบงานนี้ถือว่าจบ
  await db.collection("pairRequests").updateMany(
    {
      courseCode: COURSE_CODE, worksheetId, status: "pending",
      $or: [{ fromUid: { $in: [a.uid, b.uid] } }, { toUid: { $in: [a.uid, b.uid] } }],
    },
    { $set: { status: "closed", closedAt: new Date() } }
  );
  return true;
}

app.post("/api/pair/request", requireDb, async (req, res) => {
  try {
    const ctx = pairWorksheetOr400(req, res, req.body || {});
    if (!ctx) return;
    const { worksheetId, me } = ctx;
    const to = cleanPerson({ studentName: req.body.toName, studentNo: req.body.toNo });
    if (!to || to.uid === me.uid) return res.status(400).json({ error: "invalid_target" });

    const target = await db.collection("students").findOne({ courseCode: COURSE_CODE, uid: to.uid });
    if (!target) return res.status(404).json({ error: "student_not_found" });
    if ((await findLink(worksheetId, me.uid)) || (await findLink(worksheetId, to.uid))) {
      return res.status(409).json({ error: "already_paired" });
    }

    const reqs = db.collection("pairRequests");
    // อีกฝ่ายส่งคำขอมาหาเราอยู่แล้ว → ถือว่าตกลงกันเลย
    const reverse = await reqs.findOne({ courseCode: COURSE_CODE, worksheetId, fromUid: to.uid, toUid: me.uid, status: "pending" });
    if (reverse) {
      const ok = await createPair(worksheetId, me, to);
      return ok ? res.json({ ok: true, paired: true }) : res.status(409).json({ error: "already_paired" });
    }
    const dup = await reqs.findOne({ courseCode: COURSE_CODE, worksheetId, fromUid: me.uid, toUid: to.uid, status: "pending" });
    if (!dup) {
      await reqs.insertOne({
        courseCode: COURSE_CODE, worksheetId, status: "pending", createdAt: new Date(),
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

app.post("/api/pair/respond", requireDb, async (req, res) => {
  try {
    const me = cleanPerson(req.body);
    const { requestId, action } = req.body || {};
    if (!me || !requestId || !["accept", "decline"].includes(action)) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const { ObjectId } = require("mongodb");
    const reqs = db.collection("pairRequests");
    const r = await reqs.findOne({ _id: new ObjectId(requestId), courseCode: COURSE_CODE, toUid: me.uid, status: "pending" });
    if (!r) return res.status(404).json({ error: "request_not_found" });

    if (action === "decline") {
      await reqs.updateOne({ _id: r._id }, { $set: { status: "declined", closedAt: new Date() } });
      return res.json({ ok: true });
    }
    if ((await findLink(r.worksheetId, me.uid)) || (await findLink(r.worksheetId, r.fromUid))) {
      await reqs.updateOne({ _id: r._id }, { $set: { status: "closed", closedAt: new Date() } });
      return res.status(409).json({ error: "already_paired" });
    }
    const from = { uid: r.fromUid, name: r.fromName, no: r.fromNo };
    const ok = await createPair(r.worksheetId, me, from);
    res.status(ok ? 200 : 409).json(ok ? { ok: true, paired: true } : { error: "already_paired" });
  } catch (err) {
    console.error("pair respond error", err);
    res.status(400).json({ error: "bad_request" });
  }
});

app.post("/api/pair/cancel", requireDb, async (req, res) => {
  try {
    const me = cleanPerson(req.body);
    const { requestId } = req.body || {};
    if (!me || !requestId) return res.status(400).json({ error: "missing_fields" });
    const { ObjectId } = require("mongodb");
    await db.collection("pairRequests").updateOne(
      { _id: new ObjectId(requestId), courseCode: COURSE_CODE, fromUid: me.uid, status: "pending" },
      { $set: { status: "cancelled", closedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "bad_request" });
  }
});

// ยกเลิกการจับคู่ (ทำได้ทั้งสองฝ่าย) แบบร่างเดิมยังอยู่ ถ้าจับคู่กับคนเดิมอีกจะเห็นข้อมูลเดิม
app.post("/api/pair/unpair", requireDb, async (req, res) => {
  try {
    const ctx = pairWorksheetOr400(req, res, req.body || {});
    if (!ctx) return;
    const { worksheetId, me } = ctx;
    const link = await findLink(worksheetId, me.uid);
    if (link) {
      await db.collection("pairLinks").deleteMany({
        courseCode: COURSE_CODE, worksheetId, uid: { $in: [me.uid, link.partnerUid] },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("unpair error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- API: แชร์แบบร่างระหว่างคู่ (เฉพาะใบงาน mode==="pair") ----------
app.get("/api/draft/:worksheetId", requireDb, async (req, res) => {
  try {
    const { worksheetId } = req.params;

    if (!ALL_PAIR_WORKSHEET_IDS.has(worksheetId)) {
      return res.status(400).json({ error: "not_pair_worksheet" });
    }
    const me = cleanPerson(req.query);
    if (!me) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const link = await findLink(worksheetId, me.uid);
    if (!link) {
      return res.status(403).json({ error: "not_paired" });
    }

    const pairKey = computePairKey(COURSE_CODE, worksheetId, me.uid, link.partnerUid);
    const draft = await db.collection("drafts").findOne({ courseCode: COURSE_CODE, worksheetId, pairKey });

    // งานนี้ส่งไปแล้วโดยคนใดคนหนึ่งในคู่หรือไม่ (เทียบด้วย เลขที่+ชื่อ ของทั้งสองคน)
    const candidates = await db.collection("submissions")
      .find({
        courseCode: COURSE_CODE,
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
    const existingSubmission = candidates.find(s =>
      pairUids.has(uidOf(s.studentName, s.studentNo)) ||
      (s.partnerNo && pairUids.has(uidOf(s.partnerName || "", s.partnerNo)))
    );

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

app.put("/api/draft/:worksheetId", requireDb, async (req, res) => {
  try {
    const { worksheetId } = req.params;
    const { stepAnswers, answerText } = req.body || {};

    if (!ALL_PAIR_WORKSHEET_IDS.has(worksheetId)) {
      return res.status(400).json({ error: "not_pair_worksheet" });
    }
    const me = cleanPerson(req.body);
    if (!me) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const link = await findLink(worksheetId, me.uid);
    if (!link) {
      return res.status(403).json({ error: "not_paired" });
    }
    const studentName = me.name, studentNo = me.no;

    const pairKey = computePairKey(COURSE_CODE, worksheetId, me.uid, link.partnerUid);
    const now = new Date();
    const col = db.collection("drafts");

    const existing = await col.findOne({ courseCode: COURSE_CODE, worksheetId, pairKey });

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
      courseCode: COURSE_CODE,
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
      { courseCode: COURSE_CODE, worksheetId, pairKey },
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
app.post("/api/read", requireDb, async (req, res) => {
  try {
    const { studentName, studentNo, unitNo } = req.body || {};
    const unitNum = Number(unitNo);

    if (!studentName || !studentNo || !ALL_UNIT_NOS.has(unitNum)) {
      return res.status(400).json({ error: "missing_or_invalid_fields" });
    }

    await db.collection("readMarks").updateOne(
      { courseCode: COURSE_CODE, studentName: String(studentName).trim(), studentNo: String(studentNo).trim(), unitNo: unitNum },
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
app.get("/api/teacher/data", requireDb, async (req, res) => {
  if (req.query.key !== TEACHER_KEY) {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const submissions = await db
      .collection("submissions")
      .find({ courseCode: COURSE_CODE })
      .project({
        studentName: 1, studentNo: 1, worksheetId: 1, answerText: 1, submittedAt: 1,
        mode: 1, partnerName: 1, partnerNo: 1,
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
      .find({ courseCode: COURSE_CODE })
      .project({ studentName: 1, studentNo: 1, unitNo: 1, readAt: 1 })
      .toArray();
    res.json({ submissions, readMarks });
  } catch (err) {
    console.error("teacher data error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- API: มุมมองครู — ดูภาพหน้าจอรายการเดียว ----------
app.get("/api/teacher/screenshot/:id", requireDb, async (req, res) => {
  if (req.query.key !== TEACHER_KEY) {
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
app.get("/api/teacher/step-image/:id", requireDb, async (req, res) => {
  if (req.query.key !== TEACHER_KEY) {
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
