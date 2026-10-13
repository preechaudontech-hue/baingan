// ข้อมูลหน่วยการเรียนรู้ + ใบงาน วิชา 31901-2008 การพัฒนาซอฟต์แวร์รูปแบบเดฟออฟส์ (DevOps)
// ใช้ร่วมกันทั้งฝั่ง frontend (แสดงผล) และฝั่ง backend (validate worksheetId ตอนส่งงาน)
// courseCode เผื่อขยายระบบไปใช้กับวิชาอื่น (เช่น Backend) ในอนาคตโดยไม่ต้องรื้อโครงสร้าง

const COURSE_CODE = "31901-2008";

const READ_UNITS = [
  { no: 1, title: "แนวคิดและวัฒนธรรม DevOps", hours: "5 ชม." },
  { no: 2, title: "การจัดการเวอร์ชันด้วย Git/GitHub", hours: "10 ชม." },
  { no: 3, title: "เทคโนโลยีเสมือนและคอนเทนเนอร์ (Docker)", hours: "10 ชม." },
  { no: 4, title: "การทวนสอบและทดสอบโปรแกรม", hours: "10 ชม." },
  { no: 5, title: "การทดสอบเชิงหน้าที่/ไม่ใช่หน้าที่", hours: "5 ชม." },
  { no: 6, title: "CI/CD ด้วย GitHub Actions", hours: "15 ชม." },
  { no: 7, title: "การประกันคุณภาพซอฟต์แวร์ (QA)", hours: "5 ชม." },
  { no: 8, title: "Auto-scaling และ Load Balancing", hours: "10 ชม." },
];

const WORKSHEETS = [
  { unit:1, id:"1.1", mode:"individual", title:"DevOps กับวิธีการพัฒนาซอฟต์แวร์แบบเดิม",
    objective:"อธิบายความแตกต่างระหว่าง DevOps กับวิธีการพัฒนาซอฟต์แวร์แบบเดิมได้ และเริ่มต้นใช้งานเครื่องมือพื้นฐานของวิชา",
    instruction:"ให้นักเรียนสมัครบัญชี GitHub (หากยังไม่มี) และเข้าร่วม GitHub Student Developer Pack ด้วยอีเมล @udontech.ac.th จากนั้นเขียนสรุปสั้น ๆ ว่า DevOps ต่างจากวิธีการพัฒนาซอฟต์แวร์แบบเดิมอย่างไร",
    steps:["สมัครบัญชี GitHub ด้วยอีเมล @udontech.ac.th (หากยังไม่มีบัญชี)","สมัคร GitHub Student Developer Pack ที่ education.github.com","เขียนสรุปความยาวประมาณครึ่งหน้า A4 ว่า DevOps ต่างจากวิธีการพัฒนาซอฟต์แวร์แบบเดิมอย่างไร","ยกตัวอย่างปัญหาที่เคยพบระหว่างทำโปรเจกต์ ที่แนวคิด DevOps จะช่วยแก้ไขได้ อย่างน้อย 1 ตัวอย่าง"],
    deliverable:"พิมพ์สรุปในช่องคำตอบ + แนบไฟล์ภาพหน้าจอยืนยันการสมัคร GitHub Student Developer Pack",
    rubric:[["อธิบายความแตกต่าง DevOps กับวิธีเดิมได้ถูกต้อง",5],["ยกตัวอย่างปัญหาที่ DevOps ช่วยแก้ได้สมเหตุสมผล",3],["สมัคร GitHub/Student Pack สำเร็จ",2]] },

  { unit:2, id:"2.1", mode:"individual", title:"Git พื้นฐานรายบุคคล",
    objective:"ติดตั้งและใช้คำสั่ง Git พื้นฐานในการควบคุมเวอร์ชันได้",
    instruction:"ติดตั้ง ตั้งค่า Git แล้วสร้าง repository เว็บเพจแนะนำตัวของตนเอง",
    steps:["ติดตั้งและตั้งค่า Git (git config user.name, user.email)","สร้างโฟลเดอร์โปรเจกต์และรัน git init","สร้างไฟล์เว็บเพจแนะนำตัวอย่างง่าย (HTML)","ใช้คำสั่ง git add, git commit บันทึกการเปลี่ยนแปลงอย่างน้อย 5 ครั้ง","ตรวจสอบประวัติ commit ด้วย git log --oneline"],
    deliverable:"ภาพหน้าจอผลลัพธ์คำสั่ง git log --oneline ที่มี commit อย่างน้อย 5 ครั้ง",
    rubric:[["ติดตั้งและตั้งค่า Git ถูกต้อง",2],["มี commit อย่างน้อย 5 ครั้ง พร้อมข้อความสื่อความหมาย",6],["ใช้คำสั่งพื้นฐาน (status, log, diff) ได้ถูกต้อง",2]] },

  { unit:2, id:"2.2", mode:"individual", title:"Branch และ GitHub",
    objective:"สร้างและจัดการ branch รวมถึงเชื่อมต่อ repository กับ GitHub ได้",
    instruction:"สร้าง branch feature/contact เพิ่มหน้า contact แล้ว merge กลับ main จากนั้นเชื่อมต่อกับ GitHub",
    steps:["สร้าง branch ชื่อ feature/contact จาก branch main","เพิ่มหน้า contact ลงในเว็บเพจ แล้ว commit ใน branch นี้","สลับกลับมาที่ main และ merge branch feature/contact เข้ามา","สร้าง repository บน GitHub แล้ว push โค้ดขึ้นไป"],
    deliverable:"ลิงก์ GitHub repository ที่มีหน้า contact และประวัติการ merge branch",
    rubric:[["สร้างและสลับ branch ได้ถูกต้อง",3],["merge branch กลับ main สำเร็จไม่มีข้อผิดพลาด",3],["push ขึ้น GitHub สำเร็จ",4]] },

  { unit:2, id:"2.3", mode:"pair", title:"GitHub Flow ทำงานเป็นคู่",
    objective:"ใช้ GitHub Flow ทำงานร่วมกันเป็นทีมผ่าน Issue และ Pull Request ได้",
    instruction:"จับคู่กับเพื่อน สร้าง repository ร่วมกัน ใช้ Issue และ Pull Request ในการทำงาน",
    steps:["คนที่ 1 สร้าง repository แล้วเพิ่มคู่ของตนเป็น collaborator","ตั้งค่า branch protection rule ให้ต้อง review ก่อน merge","แต่ละคนรับ Issue คนละ 2 ข้อที่ครูกำหนด","ทำงานใน branch ของตนเอง แล้วเปิด Pull Request อ้างอิง Issue","review Pull Request ของคู่ตนเอง แล้วสลับบทบาทกัน"],
    deliverable:"ลิงก์ repository ที่มี Issue, Pull Request อย่างน้อยคนละ 2 รายการที่มี review",
    rubric:[["ตั้งค่า collaborator และ branch protection ถูกต้อง",2],["สร้าง Issue และ Pull Request อ้างอิงกันถูกต้อง",4],["ทำ Code Review ให้เพื่อนอย่างมีคุณภาพ (comment ≥2 จุด)",4]] },

  { unit:2, id:"2.4", mode:"pair", title:"Conflict Challenge",
    objective:"ตรวจพบและแก้ไข Merge Conflict ได้ถูกต้อง",
    instruction:"ร่วมกับคู่ของตนเอง แก้ไขไฟล์บรรทัดเดียวกันพร้อมกันเพื่อให้เกิด Merge Conflict แล้วแก้ไข",
    steps:["ทั้งคู่แก้ไขบรรทัดเดียวกันของไฟล์เดียวกันคนละข้อความ","พยายาม merge แล้วสังเกตเครื่องหมาย conflict (<<<<<<<, =======, >>>>>>>)","ตกลงกันว่าจะเก็บข้อความไหน หรือรวมทั้งสองฝั่ง แล้วแก้ไขไฟล์","commit และ merge ให้สำเร็จ บันทึกขั้นตอนที่แก้ไว้ใน Pull Request comment"],
    deliverable:"ลิงก์ Pull Request ที่มีการแก้ conflict พร้อม comment อธิบายขั้นตอน",
    rubric:[["ตรวจพบและเข้าใจสาเหตุของ conflict",3],["แก้ไข conflict และ merge สำเร็จ",5],["บันทึกขั้นตอนการแก้ไขใน PR comment ชัดเจน",2]] },

  { unit:3, id:"3.1", mode:"individual", title:"Dockerfile เบื้องต้น",
    objective:"เขียน Dockerfile และ build/run container ได้สำเร็จ",
    instruction:"สร้าง repository ของตนเองจากโปรเจกต์ตั้งต้นของวิชา (devops-starter) แล้วเขียน Dockerfile ให้ build image และรัน container ได้",
    steps:["สร้าง repository ของตนเองจาก Template โปรเจกต์ตั้งต้น devops-starter (ปุ่ม Use this template) แล้ว clone ลงเครื่อง รัน npm install และ npm start ให้เปิด /healthz ได้ก่อน (อ่านรายละเอียดใน README ของโปรเจกต์ตั้งต้น)","เขียนไฟล์ Dockerfile กำหนด base image, WORKDIR, COPY, RUN, EXPOSE, CMD ให้เหมาะกับโปรเจกต์ (ดูตัวอย่างในใบความรู้หน่วยที่ 3)","รันคำสั่ง docker build -t <ชื่อ> . เพื่อสร้าง image แล้วรัน docker run -p <port>:3000 <ชื่อ> เพื่อทดสอบ container","ตรวจสอบว่าแอปพลิเคชันทำงานได้ถูกต้องผ่าน container โดยเปิด /healthz ผ่านพอร์ตที่ map ไว้"],
    deliverable:"ภาพหน้าจอ container ที่รันสำเร็จ + ไฟล์ Dockerfile ใน GitHub repository",
    rubric:[["Dockerfile ถูกต้องตามโครงสร้าง",4],["build image สำเร็จไม่มี error",3],["รัน container และใช้งานแอปได้จริง",3]] },

  { unit:3, id:"3.2", mode:"individual", title:"ทดสอบและแก้ไข Dockerfile",
    objective:"วิเคราะห์และแก้ไขข้อผิดพลาดของ Dockerfile จาก error log ได้",
    instruction:"ทดสอบแก้ไข Dockerfile ให้เกิด error โดยตั้งใจ แล้ววิเคราะห์และแก้ไข",
    steps:["แก้ไข Dockerfile ให้เกิดข้อผิดพลาด (เช่น พิมพ์ชื่อไฟล์ผิด หรือลืม EXPOSE)","รัน docker build แล้วอ่าน error log ที่เกิดขึ้น","วิเคราะห์สาเหตุของข้อผิดพลาดจาก log","แก้ไข Dockerfile ให้ build และ run ได้สำเร็จอีกครั้ง","push repository ขึ้น GitHub"],
    deliverable:"บันทึก error log ที่พบ พร้อมคำอธิบายสาเหตุและวิธีแก้ไข + ลิงก์ GitHub repository",
    rubric:[["ระบุสาเหตุของ error ได้ถูกต้อง",4],["แก้ไขและ build สำเร็จ",4],["push ขึ้น GitHub ครบถ้วน",2]] },

  { unit:3, id:"3.3", mode:"individual", title:"Docker Compose เบื้องต้น",
    objective:"เขียนไฟล์ docker-compose.yml และรันหลาย service ได้",
    instruction:"เขียน docker-compose.yml ของโปรเจกต์ devops-starter ของตนเอง แล้วรันด้วย docker compose up",
    steps:["เขียนไฟล์ docker-compose.yml กำหนด service อย่างน้อย 1 ตัว (app)","รันคำสั่ง docker compose up ให้ทำงานสำเร็จ","ทดสอบเข้าใช้งานแอปพลิเคชันผ่าน container ที่รันด้วย Compose","รันคำสั่ง docker compose down เพื่อหยุดการทำงาน"],
    deliverable:"ไฟล์ docker-compose.yml ใน GitHub repository + ภาพหน้าจอผลลัพธ์ docker compose up",
    rubric:[["โครงสร้างไฟล์ docker-compose.yml ถูกต้อง",4],["รันด้วย docker compose up สำเร็จ",4],["push ขึ้น GitHub ครบถ้วน",2]] },

  { unit:3, id:"3.4", mode:"individual", title:"เชื่อมต่อ Container แอปกับฐานข้อมูล",
    objective:"ใช้ Docker Compose เชื่อมต่อ container แอปพลิเคชันกับ container ฐานข้อมูลได้",
    instruction:"เพิ่ม service ฐานข้อมูลในไฟล์ docker-compose.yml แล้วเชื่อมต่อกับ container แอป",
    steps:["เพิ่ม service ฐานข้อมูล (เช่น MongoDB) ในไฟล์ docker-compose.yml","ตั้งค่า depends_on ให้ app รอฐานข้อมูลพร้อมก่อน","ตั้งค่า environment MONGODB_URI ของ service app ให้ชี้ไปที่ชื่อ service ฐานข้อมูล (ใช้ชื่อ service ไม่ใช่ localhost; ไม่ต้องแก้โค้ด เพราะ db.js ของ devops-starter อ่านค่านี้จาก environment อยู่แล้ว)","ทดสอบรัน docker compose up แล้วยืนยันว่า /healthz แสดง db เป็น true และเพิ่ม/ดูโน้ตผ่าน POST และ GET /api/notes ได้จริง"],
    deliverable:"ไฟล์ docker-compose.yml ที่มี 2 service ขึ้นไป + ภาพหน้าจอยืนยันการเชื่อมต่อฐานข้อมูลสำเร็จ",
    rubric:[["ตั้งค่า service ฐานข้อมูลถูกต้อง",3],["เชื่อมต่อแอปกับฐานข้อมูลสำเร็จ",5],["push ขึ้น GitHub ครบถ้วน",2]] },

  { unit:4, id:"4.1", mode:"individual", title:"เขียน Unit Test และ Integration Test",
    objective:"เขียนและรัน Unit Test, Integration Test ได้ พร้อมเชื่อมต่อกับ GitHub Actions",
    instruction:"ใน devops-starter เขียน Unit Test รวมอย่างน้อย 5 เคส (มีตัวอย่างใน validate.test.js แล้ว 1 เคส) และ Integration Test อย่างน้อย 1 เคส แล้วตั้งค่า GitHub Actions ให้รันอัตโนมัติ โดยใช้ไฟล์ workflow ตั้งต้นจากใบความรู้หน่วยที่ 4 (ยังไม่ต้องเข้าใจทุกบรรทัด จะเรียนละเอียดในหน่วยที่ 6)",
    steps:["เขียน Unit Test เพิ่มอีกอย่างน้อย 4 เคส (รวมกับตัวอย่างเป็น 5 เคสขึ้นไป) สำหรับฟังก์ชัน validateNote ให้ครอบคลุมกรณีปกติ ค่าขอบเขต (เช่น ข้อความยาว 200 กับ 201 ตัวอักษร) และกรณีผิดพลาด (ข้อความว่าง, ไม่ใช่ตัวอักษร)","เขียน Integration Test อย่างน้อย 1 เคสด้วย supertest เรียก POST แล้ว GET /api/notes ว่าเห็นข้อมูลที่เพิ่ม โดยใช้ฐานข้อมูลสำหรับทดสอบผ่านตัวแปร MONGODB_URI (ห้ามใช้ฐานข้อมูลจริง)","รัน npm test บนเครื่องตนเองให้ผ่านทั้งหมดก่อน","สร้างไฟล์ .github/workflows/test.yml จากไฟล์ตั้งต้นในใบความรู้หน่วยที่ 4 (แบบที่มี services: mongo สำหรับ Integration Test) แล้ว push ดูผลที่แท็บ Actions ให้ขึ้นเครื่องหมายถูกสีเขียว"],
    deliverable:"ลิงก์ GitHub repository ที่มีไฟล์ test และ Workflow ที่รันผ่าน",
    rubric:[["Unit Test ครบ 5 เคสขึ้นไปและผ่านทั้งหมด",5],["Integration Test อย่างน้อย 1 เคสและผ่าน",3],["GitHub Actions รัน test อัตโนมัติสำเร็จ",2]] },

  { unit:5, id:"5.1", mode:"individual", title:"ทดสอบเชิงหน้าที่และไม่ใช่หน้าที่",
    objective:"ออกแบบและดำเนินการทดสอบ Functional และ Non-Functional Testing ได้",
    instruction:"ออกแบบ Test Case สำหรับ Functional Testing และ Non-Functional Testing ของแอป devops-starter ของตนเอง (ทดสอบบนเครื่องตนเองได้ ยังไม่ต้อง deploy)",
    steps:["ออกแบบ Test Case อย่างน้อย 3 เคส สำหรับ Functional Testing","ออกแบบ Test Case อย่างน้อย 1 เคส สำหรับ Non-Functional Testing (เลือก Performance หรือ Security)","ดำเนินการทดสอบตาม Test Case ที่ออกแบบไว้","บันทึกผลการทดสอบและข้อบกพร่องที่พบ (ถ้ามี) พร้อมวิธีแก้ไข"],
    deliverable:"พิมพ์สรุป Test Case และผลการทดสอบ พร้อมข้อบกพร่องที่พบและวิธีแก้ไขในช่องคำตอบ + แนบไฟล์ภาพหน้าจอผลการทดสอบ",
    rubric:[["ออกแบบ Functional Test Case สมเหตุสมผลครบ 3 เคส",4],["ออกแบบ Non-Functional Test Case ได้เหมาะสม",3],["บันทึกผลและวิเคราะห์ข้อบกพร่องชัดเจน",3]] },

  { unit:6, id:"6.1", mode:"individual", title:"CI Pipeline ด้วย GitHub Actions",
    objective:"ต่อยอด Workflow จากใบงาน 4.1 ให้เป็น CI ที่ตรวจทั้ง test และการ build Docker image อัตโนมัติ และบังคับให้ผ่านก่อน merge ได้",
    instruction:"ต่อยอดไฟล์ workflow ที่สร้างไว้ในใบงาน 4.1 ให้เป็น .github/workflows/ci.yml ที่ตรวจ test และ build Docker image อัตโนมัติ แล้วตั้งให้ต้องผ่านก่อน merge เข้า main",
    steps:["เปลี่ยนชื่อไฟล์ test.yml จากใบงาน 4.1 เป็น ci.yml (ใช้ git mv) และตั้งชื่อ workflow เป็น CI","กำหนด trigger ให้ทำงานทั้งเมื่อ push เข้า main และเมื่อเปิด pull request","เพิ่มการแคช npm (cache: npm ใน setup-node) เพื่อให้รันเร็วขึ้น แล้วเปรียบเทียบเวลารันก่อนและหลัง","เพิ่ม step docker build -t devops-starter . เพื่อตรวจว่า Dockerfile (จากใบงาน 3.1) build ผ่านทุกครั้งที่โค้ดเปลี่ยน","เพิ่ม badge สถานะ CI ไว้ใน README.md ของ repository","ตั้ง branch protection ให้ main ต้องผ่าน status check ของ CI ก่อน merge (ต้องเป็น public repository หรือบัญชีที่ได้สิทธิ์ GitHub Student Pack) แล้วทดสอบเปิด Pull Request ว่าปุ่ม merge ถูกล็อกเมื่อ CI ยังไม่ผ่าน"],
    deliverable:"ลิงก์ GitHub repository ที่มีไฟล์ ci.yml และ badge ใน README + ลิงก์ Pull Request ที่แสดงว่า CI ผ่านและบังคับก่อน merge",
    rubric:[["ต่อยอด Workflow ได้ครบ (trigger pull request, แคช npm, docker build)",4],["Workflow รันผ่านสำเร็จและมี badge ใน README",3],["ตั้ง branch protection ให้ต้องผ่าน CI ก่อน merge ได้ถูกต้อง",3]] },

  { unit:6, id:"6.2", mode:"individual", title:"วิเคราะห์และแก้ไข CI ที่ล้มเหลว",
    objective:"อ่านผลการรัน Workflow ที่ล้มเหลวและแก้ไขให้ผ่านได้",
    instruction:"จงใจทำให้ test fail แล้วอ่าน log วิเคราะห์และแก้ไขจนผ่าน",
    steps:["แก้โค้ดหรือ test ให้เกิดความล้มเหลวโดยตั้งใจ แล้ว push","เปิดดูผลการรัน Workflow ที่ล้มเหลวบน GitHub Actions","อ่าน log วิเคราะห์หาสาเหตุของความล้มเหลว","แก้ไขโค้ดให้ Workflow กลับมาผ่านอีกครั้ง"],
    deliverable:"บันทึกสาเหตุของความล้มเหลวที่วิเคราะห์ได้ พร้อมลิงก์ Workflow ที่แก้ไขจนผ่านแล้ว",
    rubric:[["วิเคราะห์สาเหตุความล้มเหลวได้ถูกต้อง",5],["แก้ไขจน Workflow ผ่านสำเร็จ",5]] },

  { unit:6, id:"6.3", mode:"individual", title:"Deploy ขึ้น Render.com",
    objective:"เชื่อมต่อ GitHub เข้ากับ Render.com เพื่อ Deploy อัตโนมัติได้",
    instruction:"สมัคร Render.com แล้ว deploy โปรเจกต์ devops-starter ของตนเองให้สำเร็จ (ใช้ MongoDB Atlas เป็นฐานข้อมูล)",
    steps:["สมัครบัญชี Render.com ด้วยอีเมล @udontech.ac.th","สร้าง Web Service ใหม่แล้วเชื่อมต่อกับ GitHub repository ของตนเอง","กำหนด Build Command และ Start Command ให้ถูกต้อง","ยืนยันว่า deploy สำเร็จและเข้าใช้งานผ่าน URL ได้จริง"],
    deliverable:"URL ของโปรเจกต์ที่ deploy บน Render.com สำเร็จ",
    rubric:[["ตั้งค่า Web Service และเชื่อมต่อ GitHub ถูกต้อง",4],["Deploy สำเร็จและใช้งานได้จริงผ่าน URL",6]] },

  { unit:6, id:"6.4", mode:"individual", title:"Environment Variable และ Auto-Deploy",
    objective:"จัดการค่าลับด้วย Environment Variable และทดสอบ Auto-Deploy ได้",
    instruction:"ตั้งค่า Environment Variable บน Render.com โดยไม่ Hardcode ในโค้ด แล้วทดสอบ Auto-Deploy",
    steps:["ระบุค่าลับที่ใช้ในโปรเจกต์ (เช่น MONGODB_URI)","ตั้งค่า Environment Variable บน Render.com แทนการเขียนในโค้ดโดยตรง","ตรวจว่าโค้ดอ่านค่าจาก process.env ไม่ใช่ค่าที่เขียนตายตัว (devops-starter ทำไว้แล้วใน db.js ให้หาตำแหน่งนั้นและอธิบายว่าทำไมจึงปลอดภัยกว่าการเขียนรหัสผ่านในโค้ด)","ทดสอบแก้โค้ดเล็กน้อยแล้ว push เพื่อยืนยันว่า Render Auto-Deploy เวอร์ชันใหม่ให้อัตโนมัติ"],
    deliverable:"ภาพหน้าจอ Environment Variable บน Render.com (ปิดบังค่าจริง) + หลักฐานว่า Auto-Deploy ทำงาน",
    rubric:[["ไม่มีค่าลับ Hardcode อยู่ในโค้ดที่ push ขึ้น GitHub",5],["Auto-Deploy ทำงานสำเร็จเมื่อ push โค้ดใหม่",5]] },

  { unit:7, id:"7.1", mode:"pair", title:"Code Review และ CI/CD Metrics",
    objective:"ทำ Code Review ผ่าน Pull Request และวิเคราะห์ CI/CD Metrics ของโปรเจกต์ตนเองได้",
    instruction:"จับคู่ทำ Code Review ให้กันผ่าน GitHub Pull Request แล้วสรุปค่า Metrics ของโปรเจกต์",
    steps:["จับคู่กับเพื่อนแล้วทำ Code Review ผ่าน Pull Request อย่างน้อย 1 ครั้ง (คอมเมนต์อย่างน้อย 2 จุด)","รวบรวมข้อมูลการ deploy ของ repository devops-starter ของตนเองในช่วง 2 สัปดาห์ที่ผ่านมา","คำนวณ/ประมาณค่า Deployment Frequency (ความถี่ในการ deploy)","คำนวณ/ประมาณค่า Lead Time for Changes (เวลาตั้งแต่ commit จนขึ้นใช้งานจริง)"],
    deliverable:"ลิงก์ Pull Request ที่มี Code Review + พิมพ์สรุปค่า Metrics ทั้งสองตัวในช่องคำตอบ (แนบไฟล์ภาพหน้าจอประกอบได้)",
    rubric:[["ทำ Code Review อย่างมีคุณภาพ (คอมเมนต์ ≥2 จุด)",5],["คำนวณและอธิบายค่า Metrics ได้ถูกต้องสมเหตุสมผล",5]] },

  { unit:8, id:"8.1", mode:"individual", title:"Load Balancing และ Auto-scaling ด้วย Docker Compose",
    objective:"ฝึกปฏิบัติ Load Balancing และจำลอง Auto-scaling ด้วย Docker Compose และ Nginx บนเครื่องตนเอง",
    instruction:"ตั้งค่า Docker Compose ให้รันหลาย container พร้อม Nginx เป็น Load Balancer แล้วเขียนสคริปต์จำลอง Auto-scaling",
    steps:["ตั้งค่า Docker Compose ให้รัน container ของแอป devops-starter ของตนเอง 3 ตัวพร้อมกัน (docker compose up --scale app=3) โดยไม่เปิดพอร์ตของ service app ออกเครื่อง (ใช้ expose แทน ports)","เพิ่ม service Nginx ในไฟล์ docker-compose.yml ให้ทำหน้าที่ Load Balancer แบบ Round Robin","ทดสอบยิง request ซ้ำ ๆ ไปที่ /whoami ผ่าน Nginx แล้วสังเกตว่าชื่อ container วนไปทีละตัว","เขียนสคริปต์อย่างง่าย 1 ไฟล์ที่จำลองการเพิ่ม/ลดจำนวน container ตามเงื่อนไขที่กำหนดเอง (ตั้ง ENABLE_HEAVY=true ให้ service app เพื่อใช้ endpoint /heavy สร้างโหลดทดสอบ)"],
    deliverable:"ไฟล์ docker-compose.yml + nginx.conf + สคริปต์จำลอง Auto-scaling + ภาพหน้าจอผลการทดสอบกระจาย request",
    rubric:[["ตั้งค่า Docker Compose รันหลาย container สำเร็จ",3],["Nginx กระจาย request แบบ Round Robin ได้จริง",4],["สคริปต์จำลอง Auto-scaling ทำงานได้ตามเงื่อนไขที่กำหนด",3]] },
];

const GROUP_WORKSHEETS = [
  { id:"G.1", title:"จัดตั้งทีมและ Team Charter", week:"สัปดาห์ที่ 1-2 (ประกาศทีมล่วงหน้า)",
    objective:"จัดตั้งทีมจำลองบริษัทซอฟต์แวร์ กำหนดบทบาทเริ่มต้น และเตรียมเครื่องมือพื้นฐานของทีมให้พร้อมก่อนเริ่ม Sprint จริงในสัปดาห์ที่ 6",
    instruction:"รวมทีม 4-5 คนตามที่ครูจัดไว้ ตั้งชื่อบริษัทจำลอง กำหนดบทบาทเริ่มต้น และสร้างพื้นที่ทำงานร่วมกันของทีม",
    steps:["ตั้งชื่อ \"บริษัทจำลอง\" ของทีม พร้อมคำขวัญ/สโลแกนสั้น ๆ","กำหนดสมาชิกและบทบาทเริ่มต้น (Developer / Tester / Ops / Scrum Master) โดยรู้ล่วงหน้าว่าจะหมุนเวียนบทบาททุก Sprint","สร้าง GitHub Organization หรือ repository ของทีม (ยังไม่ต้องมีโค้ด เตรียมโครงไว้ก่อน)","สร้าง Google Sheet 'Sprint Backlog' และ Google Doc 'Team Charter' ของทีม (ใช้เทมเพลตที่ครูแจก)","เขียน Team Charter: เป้าหมายของทีม, กติกาการทำงานร่วมกัน, ช่องทางติดต่อสื่อสาร"],
    deliverable:"ลิงก์ GitHub repository ของทีม + ลิงก์ Google Doc Team Charter + ลิงก์ Google Sheet Sprint Backlog",
    rubric:[["กำหนดสมาชิกและบทบาทเริ่มต้นครบถ้วนชัดเจน",3],["สร้าง GitHub repository และพื้นที่ทำงานทีมสำเร็จ",4],["Team Charter ระบุเป้าหมายและกติกาทีมสมเหตุสมผล",3]] },

  { id:"G.2", title:"Sprint 1 — ส่งมอบฟีเจอร์แรก", week:"สัปดาห์ที่ 6-8",
    objective:"ทีมร่วมกันส่งมอบฟีเจอร์แรกของโปรเจกต์แบบ end-to-end ตั้งแต่ Git จนถึง Deploy อย่างง่าย โดยหมุนเวียนบทบาทในทีม",
    instruction:"รับแอปพลิเคชันตั้งต้น (starter app) จากครู แล้วร่วมกันพัฒนาฟีเจอร์แรกให้ครบวงจร Git → CI → Deploy",
    steps:["รับ starter app จากครูผ่าน GitHub Classroom และ clone ลงเครื่องทุกคนในทีม","แบ่งงานตามบทบาท (Developer เขียนโค้ด, Tester เขียน test, Ops ดูแล pipeline, Scrum Master จัดการ Sprint Backlog)","ทุกคนเปิด Pull Request อย่างน้อยคนละ 1 รายการ และต้องถูก merge สำเร็จ","ตั้งค่า GitHub Actions เบื้องต้นให้ build และรัน test อัตโนมัติ (ใช้ไฟล์ workflow ตั้งต้นจากใบความรู้หน่วยที่ 4)","เข้าร่วม Daily Stand-up ต้นคาบทุกครั้ง บันทึกลง Google Sheet","ทำ Sprint Review ท้าย Sprint นำเสนอผลงานให้ครู (ลูกค้า) ด้วย Google Slides และทำ Retrospective ผ่าน Google Form"],
    deliverable:"ลิงก์ repository ทีมที่มี PR ครบทุกคน + ลิงก์ Google Slides Sprint Review + ลิงก์ Retrospective Form ที่ตอบแล้ว",
    rubric:[["ทุกคนในทีมมี Pull Request ที่ merge สำเร็จ",4],["GitHub Actions ทำงาน build/test อัตโนมัติ",3],["บันทึก Daily Stand-up ครบถ้วนสม่ำเสมอ",2],["Sprint Review และ Retrospective ครบถ้วน",1]] },

  { id:"G.3", title:"Sprint 2 — บูรณาการ CI/CD เต็มรูปแบบ", week:"สัปดาห์ที่ 9-11",
    objective:"บูรณาการ CI/CD Pipeline ของทีมให้สมบูรณ์ตั้งแต่ push จนถึง Deploy อัตโนมัติ และทำงานร่วมกันแก้ปัญหา Pipeline ล้มเหลว",
    instruction:"ขยาย Pipeline ของทีมให้ Deploy อัตโนมัติขึ้น Render.com เฉพาะเมื่อ GitHub Actions ผ่านเท่านั้น (ตรงกับหน่วยที่ 6 ตอนที่ 3)",
    steps:["หมุนเวียนบทบาทในทีมรอบใหม่ ให้ทุกคนได้ลองบทบาทที่ยังไม่เคยทำ","ตั้งค่า Render.com ให้ Auto-Deploy เฉพาะเมื่อ GitHub Actions รันผ่านแล้วเท่านั้น","ตั้งค่า Environment Variable ของทีมบน Render.com โดยไม่ Hardcode ค่าลับในโค้ด","ทดสอบ push โค้ดจริงจากทุกคนในทีม และร่วมกันแก้ไขปัญหา Pipeline ที่ล้มเหลว (ถ้ามี)","บันทึก Daily Stand-up ต่อเนื่องใน Google Sheet และทำ Sprint Review/Retrospective ท้าย Sprint เหมือนเดิม"],
    deliverable:"ลิงก์ Pipeline ของทีมที่ Deploy อัตโนมัติสำเร็จ + URL ที่ใช้งานได้จริง + ลิงก์ Sprint Review/Retrospective",
    rubric:[["Pipeline ทั้งทีม Deploy อัตโนมัติเมื่อ test ผ่านเท่านั้น",4],["ไม่มีค่าลับ Hardcode ในโค้ดของทีม",3],["ทุกคนมีส่วนร่วม push โค้ดและแก้ปัญหาร่วมกัน",2],["Sprint Review และ Retrospective ครบถ้วน",1]] },

  { id:"G.4", title:"Sprint 3 — ทดสอบ คุณภาพ และ Auto-scaling", week:"สัปดาห์ที่ 12-14",
    objective:"ทีมร่วมกันเพิ่มคุณภาพซอฟต์แวร์ด้วยการทดสอบและ Code Review พร้อมฝึก Load Balancing/Auto-scaling ก่อนเตรียมนำเสนอ Demo Day",
    instruction:"เก็บงานด้านคุณภาพของโปรเจกต์ทีม เพิ่มการเฝ้าระวังระบบ และทดลอง Load Balancing ด้วย Docker Compose",
    steps:["หมุนเวียนบทบาทในทีมรอบสุดท้าย ให้ครบทุกคนภายในภาคเรียน","เพิ่ม Unit Test/Integration Test ให้ครอบคลุมฟีเจอร์หลักของโปรเจกต์ทีม","ทำ Code Review ข้ามกันในทีมก่อน merge ทุกครั้ง","ทดลองตั้งค่า Docker Compose หลาย container พร้อม Nginx Load Balancer สำหรับโปรเจกต์ของทีม (ต่อยอดจากหน่วยที่ 8)","เตรียมสไลด์และสคริปต์นำเสนอสำหรับ Demo Day"],
    deliverable:"ลิงก์ repository ที่มี test ครอบคลุม + หลักฐาน Code Review + ไฟล์ docker-compose.yml ของทีม + สไลด์เตรียม Demo Day",
    rubric:[["มี Test ครอบคลุมฟีเจอร์หลักของทีม",3],["ทำ Code Review ข้ามกันในทีมสม่ำเสมอ",3],["ทดลอง Load Balancing ด้วย Docker Compose สำเร็จ",3],["เตรียมสไลด์ Demo Day พร้อมนำเสนอ",1]] },

  { id:"G.5", title:"Demo Day และสรุปโครงงาน", week:"สัปดาห์ที่ 15",
    objective:"นำเสนอผลงานโครงงานทีมฉบับสมบูรณ์ และประเมินการทำงานร่วมกันของสมาชิกในทีม",
    instruction:"นำเสนอผลงานทีมต่อครู (ในบทบาทลูกค้า) และเพื่อนร่วมชั้น พร้อมประเมินเพื่อนร่วมทีม",
    steps:["เตรียมสาธิตระบบที่ทำงานได้จริงตั้งแต่ push โค้ดจนถึงใช้งานจริงบน Render.com","นำเสนอผลงานทีม 10-15 นาที ครอบคลุม: ปัญหาที่เลือกแก้, สถาปัตยกรรม/Pipeline, สิ่งที่ได้เรียนรู้","ตอบคำถามจากครูและเพื่อนร่วมชั้น","แต่ละคนทำแบบประเมินเพื่อนร่วมทีม (Peer Assessment) ผ่าน Google Form","เขียนสรุปโครงงานภาพรวมของทีม ส่งเป็นข้อความในช่องคำตอบเพื่อปิดโครงงาน"],
    deliverable:"URL ระบบที่ใช้งานได้จริง + ลิงก์สไลด์นำเสนอ + พิมพ์สรุปโครงงานในช่องคำตอบ + แนบไฟล์ภาพหน้าจอหลักฐานการทำแบบประเมินเพื่อนร่วมทีม",
    rubric:[["ระบบสาธิตทำงานได้จริงครบวงจร",4],["การนำเสนอชัดเจน ตอบคำถามได้",3],["เอกสารสรุปโครงงานครบถ้วน",2],["ทำ Peer Assessment ครบทุกคน",1]] },
];

const ALL_WORKSHEET_IDS = new Set([...WORKSHEETS.map(w => w.id), ...GROUP_WORKSHEETS.map(w => w.id)]);
const ALL_UNIT_NOS = new Set(READ_UNITS.map(u => u.no));
// ใบงานที่ต้องทำเป็นคู่ (เปิดใช้ฟีเจอร์แชร์แบบร่างระหว่างคู่ฝั่ง server/client)
const ALL_PAIR_WORKSHEET_IDS = new Set(WORKSHEETS.filter(w => w.mode === "pair").map(w => w.id));

module.exports = { COURSE_CODE, READ_UNITS, WORKSHEETS, GROUP_WORKSHEETS, ALL_WORKSHEET_IDS, ALL_UNIT_NOS, ALL_PAIR_WORKSHEET_IDS };
