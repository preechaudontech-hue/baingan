// ล้างข้อมูลทดสอบก่อนเริ่มใช้จริง: ลบงานที่ส่ง การมาร์กอ่าน แบบร่าง คู่/ทีม และ session
// ไม่ลบ accounts (รายชื่อนักเรียน) และไม่ลบโค้ด
//
// วิธีใช้ (รันโดยครู ใส่ connection string ของ Atlas เอง อย่าบันทึกลงไฟล์):
//   MONGODB_URI="mongodb+srv://..." node scripts/reset-data.js          # ดูจำนวนที่จะลบ (ยังไม่ลบ)
//   MONGODB_URI="mongodb+srv://..." node scripts/reset-data.js --yes    # ลบจริง
const { MongoClient } = require("mongodb");

const COLLECTIONS = [
  "submissions", "readMarks", "drafts", "students",
  "pairLinks", "pairRequests", "teams", "teamInvites", "sessions",
];

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error("ต้องตั้ง MONGODB_URI"); process.exit(1); }
  const doIt = process.argv.includes("--yes");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  console.log(`ฐานข้อมูล: ${db.databaseName}`);
  for (const name of COLLECTIONS) {
    const col = db.collection(name);
    const n = await col.countDocuments();
    if (doIt) {
      const r = await col.deleteMany({});
      console.log(`${name}: ลบ ${r.deletedCount} รายการ`);
    } else {
      console.log(`${name}: ${n} รายการ (ยังไม่ลบ ใส่ --yes เพื่อลบจริง)`);
    }
  }
  console.log(`accounts: ${await db.collection("accounts").countDocuments()} บัญชี (ไม่ถูกลบ)`);
  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
