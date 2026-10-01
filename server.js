const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { MongoClient } = require("mongodb");
const { COURSE_CODE, READ_UNITS, WORKSHEETS, GROUP_WORKSHEETS, ALL_WORKSHEET_IDS, ALL_UNIT_NOS, ALL_PAIR_WORKSHEET_IDS } = require("./data/worksheets.js");

// worksheetId -> "individual" | "pair" เผื่อ validate/บันทึกตอนส่งงาน
const WORKSHEET_MODE = new Map(WORKSHEETS.map(w => [w.id, w.mode || "individual"]));

const MAX_STEP_ANSWER_LEN = 2000;
const MAX_ANSWER_TEXT_LEN = 10000;

function sanitizeStepAnswers(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(s => s && Number.isInteger(s.idx) && s.idx >= 0 && s.idx < 50)
    .map(s => ({
      idx: s.idx,
      done: !!s.done,
      answer: String(s.answer || "").slice(0, MAX_STEP_ANSWER_LEN),
    }));
}

function computePairKey(courseCode, worksheetId, studentNo, partnerNo) {
  const sorted = [String(studentNo), String(partnerNo)].sort();
  return crypto
    .createHash("sha256")
    .update(`${courseCode}|${worksheetId}|${sorted.join(",")}`)
    .digest("hex")
    .slice(0, 24);
}

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const TEACHER_KEY = process.env.TEACHER_KEY || "changeme";
// ขนาดสูงสุดของ request body (รองรับภาพหน้าจอ base64 ที่มีขนาดใหญ่กว่าข้อความทั่วไป)
const BODY_LIMIT = "12mb";

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
  console.log("[ok] Connected to MongoDB");
}

function requireDb(req, res, next) {
  if (!db) return res.status(503).json({ error: "database_unavailable" });
  next();
}

// ---------- API: ส่งใบงาน ----------
app.post("/api/submit", requireDb, async (req, res) => {
  try {
    const { studentName, studentNo, worksheetId, answerText, screenshotBase64, stepAnswers, partnerName, partnerNo } = req.body || {};

    if (!studentName || !studentNo || !worksheetId) {
      return res.status(400).json({ error: "missing_fields" });
    }
    if (!ALL_WORKSHEET_IDS.has(worksheetId)) {
      return res.status(400).json({ error: "invalid_worksheet_id" });
    }
    if (screenshotBase64 && screenshotBase64.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: "screenshot_too_large" });
    }

    const mode = WORKSHEET_MODE.get(worksheetId) || "individual";

    const doc = {
      courseCode: COURSE_CODE,
      studentName: String(studentName).trim().slice(0, 200),
      studentNo: String(studentNo).trim().slice(0, 50),
      worksheetId,
      answerText: String(answerText || "").slice(0, MAX_ANSWER_TEXT_LEN),
      screenshotBase64: screenshotBase64 || null,
      mode,
      stepAnswers: sanitizeStepAnswers(stepAnswers),
      partnerName: mode === "pair" && partnerName ? String(partnerName).trim().slice(0, 200) : null,
      partnerNo: mode === "pair" && partnerNo ? String(partnerNo).trim().slice(0, 50) : null,
      submittedAt: new Date(),
    };

    const result = await db.collection("submissions").insertOne(doc);
    res.json({ ok: true, id: result.insertedId });
  } catch (err) {
    console.error("submit error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ---------- API: แชร์แบบร่างระหว่างคู่ (เฉพาะใบงาน mode==="pair") ----------
app.get("/api/draft/:worksheetId", requireDb, async (req, res) => {
  try {
    const { worksheetId } = req.params;
    const { studentNo, partnerNo } = req.query;

    if (!ALL_PAIR_WORKSHEET_IDS.has(worksheetId)) {
      return res.status(400).json({ error: "not_pair_worksheet" });
    }
    if (!studentNo || !partnerNo) {
      return res.status(400).json({ error: "missing_fields" });
    }

    const pairKey = computePairKey(COURSE_CODE, worksheetId, studentNo, partnerNo);
    const draft = await db.collection("drafts").findOne({ courseCode: COURSE_CODE, worksheetId, pairKey });

    const existingSubmission = await db.collection("submissions").findOne(
      {
        courseCode: COURSE_CODE,
        worksheetId,
        $or: [
          { studentNo: String(studentNo) },
          { studentNo: String(partnerNo) },
          { partnerNo: String(studentNo) },
          { partnerNo: String(partnerNo) },
        ],
      },
      { sort: { submittedAt: -1 } }
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
    const { studentName, studentNo, partnerNo, stepAnswers, answerText } = req.body || {};

    if (!ALL_PAIR_WORKSHEET_IDS.has(worksheetId)) {
      return res.status(400).json({ error: "not_pair_worksheet" });
    }
    if (!studentName || !studentNo || !partnerNo) {
      return res.status(400).json({ error: "missing_fields" });
    }

    const pairKey = computePairKey(COURSE_CODE, worksheetId, studentNo, partnerNo);
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
    if (!members.some(m => m.studentNo === String(studentNo))) {
      members.push({ studentName: String(studentName).trim().slice(0, 200), studentNo: String(studentNo).trim().slice(0, 50) });
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
        mode: 1, stepAnswers: 1, partnerName: 1, partnerNo: 1,
        hasScreenshot: { $toBool: "$screenshotBase64" },
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
    if (!doc || !doc.screenshotBase64) return res.status(404).end();
    res.json({ screenshotBase64: doc.screenshotBase64 });
  } catch (err) {
    res.status(400).json({ error: "bad_request" });
  }
});

app.get("/healthz", (req, res) => res.json({ ok: true, db: !!db }));

app.listen(PORT, async () => {
  console.log(`DevOps worksheet system listening on port ${PORT}`);
  await connectDb();
});
