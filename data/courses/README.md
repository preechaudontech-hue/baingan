# เพิ่มวิชาใหม่

ระบบโหลดทุกโฟลเดอร์ใน `data/courses/<รหัสวิชา>/` อัตโนมัติตอนเริ่มเซิร์ฟเวอร์ เพิ่มวิชา = เพิ่มโฟลเดอร์ ไม่ต้องแก้โค้ดระบบ
ถ้าข้อมูลผิดรูปแบบ เซิร์ฟเวอร์จะหยุดพร้อมบอกสาเหตุ (ตรวจใน `data/courses.js`)

```
data/courses/<รหัสวิชา>/
  worksheets.js          ข้อมูลวิชาและใบงาน (จำเป็น)
  knowledge/unit1.js ... ใบความรู้รายหน่วย (ไม่บังคับ)
```

## worksheets.js

ต้อง export: `COURSE_CODE`, `COURSE_INFO`, `READ_UNITS`, `WORKSHEETS` และ (ถ้ามี) `GROUP_WORKSHEETS`

- `COURSE_CODE` ต้องตรงกับชื่อโฟลเดอร์
- `COURSE_INFO`: `shortName`, `hubTitle` (จำเป็น), `fullName`, `totalHours`, และ `group` สำหรับส่วนใบงานกลุ่ม
  `{ sectionTitle, sectionNote, badge, cardTitle, cardSub, itemLabel, maxSize }` (`maxSize` = จำนวนสมาชิกทีมสูงสุด ค่าเริ่มต้น 5)
- `READ_UNITS`: `[{ no, title, hours, ... }]`
- `WORKSHEETS`: ใบงานรายหน่วย แต่ละใบมี `unit`, `id` (ไม่ซ้ำทั้งวิชา), `mode` (`"individual"` หรือ `"pair"`), `title`, `objective`, `instruction`, `steps[]`, `deliverable`, `rubric` (`[[เกณฑ์, คะแนน], ...]`)
  - ห้ามสลับลำดับ/จำนวน `steps` กลางเทอม เพราะคำตอบที่ส่งแล้วอ้างอิงด้วยลำดับขั้นตอน
- `GROUP_WORKSHEETS`: ใบงานกลุ่ม โครงสร้างเหมือนใบงานรายหน่วย (มี `week` แทน `unit`)

## ใบความรู้ knowledge/unitN.js

export อาร์เรย์ของบล็อก: `p`, `ul`, `ol`, `code`, `note` (kind: tip/warn/info), `table`, `ref`
ในข้อความใช้ `**ตัวหนา**`, `` `โค้ด` ``, `*เอียง*` ได้ ดูตัวอย่างจากวิชา 31901-2008

## URL ที่ได้

- หน้าวิชา `/c/<รหัสวิชา>/` ใบความรู้ `/c/<รหัสวิชา>/learn.html?unit=N`
- หน้าครู `/c/<รหัสวิชา>/teacher.html?key=<TEACHER_KEY>`
- หน้ารวมวิชา `/` (ดึงรายการจาก `/api/courses`)

ข้อมูลในฐานข้อมูลแยกวิชาด้วยฟิลด์ `courseCode`
