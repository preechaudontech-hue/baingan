const L = (...lines) => lines.join("\n");

module.exports = {
  unit: 2,
  intro: "เรียนรู้ Git และ GitHub ตั้งแต่คำสั่งพื้นฐานจนถึงการทำงานเป็นทีมด้วย Branch, Pull Request, Code Review และการแก้ Merge Conflict",
  objectives: [
    "อธิบายว่า **Version Control** ช่วยแก้ปัญหาอะไร และ Git ต่างจาก GitHub อย่างไร",
    "ใช้คำสั่ง Git พื้นฐาน (`init`, `add`, `commit`, `push`, `pull`) ได้ถูกต้อง",
    "สร้างและรวม **branch** ได้ และเข้าใจขั้นตอน **GitHub Flow**",
    "เปิด **Pull Request** และทำ **Code Review** ให้เพื่อนได้",
    "ตรวจพบและแก้ **Merge Conflict** ได้",
  ],
  sections: [
    {
      id: "s1",
      title: "1. Version Control คืออะไร",
      blocks: [
        { t: "p", x: "เคยมีไฟล์ชื่อ `รายงาน_final.docx`, `รายงาน_final2.docx`, `รายงาน_final_จริงๆ.docx` ไหม นั่นคือ \"ระบบควบคุมเวอร์ชันแบบทำมือ\" ที่ยุ่งเหยิง และพังทันทีเมื่อมีหลายคนแก้พร้อมกัน" },
        { t: "p", x: "**ระบบควบคุมเวอร์ชัน (Version Control System, VCS)** คือระบบที่บันทึกประวัติการเปลี่ยนแปลงของไฟล์ไว้ทุกครั้ง ทำให้" },
        { t: "ul", items: [
          "ย้อนกลับไปดูหรือกู้คืนเวอร์ชันเก่าได้ว่าใครแก้อะไรเมื่อไหร่",
          "หลายคนแก้โค้ดพร้อมกันได้โดยไม่ทับงานกัน",
          "ทดลองฟีเจอร์ใหม่แยกจากโค้ดหลักได้อย่างปลอดภัย",
        ] },
        { t: "table", head: ["", "Git", "GitHub"], rows: [
          ["คืออะไร", "โปรแกรมควบคุมเวอร์ชันที่ติดตั้งในเครื่อง", "เว็บบริการออนไลน์ที่เก็บ Git repository"],
          ["ใช้ทำอะไร", "บันทึกประวัติ แตก branch รวมโค้ด", "เก็บโค้ดบนคลาวด์ ทำงานเป็นทีม Pull Request, Issue, Actions"],
          ["ต้องต่อเน็ตไหม", "ไม่ต้อง (ทำงานในเครื่องได้ทั้งหมด)", "ต้องต่อเน็ต"],
        ] },
        { t: "note", kind: "info", x: "Git เป็นแบบ **กระจาย (Distributed)** คือทุกเครื่องมีประวัติครบทั้งโปรเจกต์ ถ้า GitHub ล่ม ทุกคนยังมีสำเนาเต็มอยู่ในเครื่องตัวเอง" },
      ],
    },
    {
      id: "s2",
      title: "2. เข้าใจ 4 พื้นที่ของ Git",
      blocks: [
        { t: "p", x: "ความเข้าใจผิดที่พบบ่อยที่สุดของมือใหม่คือ \"แก้ไฟล์แล้วก็ถูกบันทึกแล้ว\" จริงๆ แล้วโค้ดต้องผ่านหลายพื้นที่ก่อนจะไปถึง GitHub" },
        { t: "code", lang: "text", x: L(
          "Working Directory  --git add-->  Staging Area  --git commit-->  Local Repository  --git push-->  Remote (GitHub)",
          "(ไฟล์ที่คุณแก้)                  (เลือกว่าจะบันทึกอะไร)         (ประวัติในเครื่อง)                  (ประวัติบนคลาวด์)",
        ) },
        { t: "ul", items: [
          "**Working Directory** — โฟลเดอร์โปรเจกต์ที่คุณแก้ไฟล์อยู่",
          "**Staging Area** — \"ตะกร้า\" ที่คุณเลือกไฟล์ที่ต้องการบันทึกในรอบนี้ (`git add`)",
          "**Local Repository** — ประวัติการบันทึก (commit) ในเครื่อง (`git commit`)",
          "**Remote** — ประวัติบน GitHub (`git push` ส่งขึ้น, `git pull` ดึงลง)",
        ] },
      ],
    },
    {
      id: "s3",
      title: "3. ตั้งค่า Git ครั้งแรก",
      blocks: [
        { t: "p", x: "ต้องบอก Git ว่าคุณคือใคร เพราะทุก commit จะมีชื่อและอีเมลผู้บันทึกติดไปด้วย ทำเพียงครั้งเดียวต่อเครื่อง" },
        { t: "code", lang: "bash", x: L(
          'git config --global user.name "ชื่อของคุณ"',
          'git config --global user.email "อีเมลที่ใช้สมัคร GitHub"',
          "git config --global init.defaultBranch main",
          "git config --list          # ตรวจสอบค่าที่ตั้งไว้",
        ) },
        { t: "note", kind: "tip", x: "ใช้อีเมลเดียวกับที่สมัคร GitHub เพื่อให้ commit ของคุณถูกนับเป็นผลงานในโปรไฟล์ GitHub ของคุณ" },
      ],
    },
    {
      id: "s4",
      title: "4. คำสั่ง Git พื้นฐาน",
      blocks: [
        { t: "code", lang: "bash", x: L(
          "git init                       # เริ่มต้น repository ใหม่ในโฟลเดอร์ปัจจุบัน",
          "git status                     # ดูสถานะ: ไฟล์ไหนแก้แล้ว ไฟล์ไหนอยู่ใน staging",
          "git add index.html             # เพิ่มไฟล์เข้า staging (git add . = ทุกไฟล์)",
          'git commit -m "เพิ่มหน้าแรก"   # บันทึกการเปลี่ยนแปลงพร้อมข้อความอธิบาย',
          "git log --oneline              # ดูประวัติ commit แบบย่อ",
          "git diff                       # ดูว่าแก้อะไรไปบ้างที่ยังไม่ได้ add",
          "git clone <url>                # คัดลอกโปรเจกต์จาก GitHub มาที่เครื่อง",
          "git push origin main           # ส่ง commit ขึ้น GitHub",
          "git pull origin main           # ดึง commit ล่าสุดจาก GitHub ลงมา",
        ) },
        { t: "p", x: "ตัวอย่างการทำงานรอบหนึ่งตั้งแต่ต้น" },
        { t: "code", lang: "bash", x: L(
          "mkdir my-profile && cd my-profile",
          "git init",
          'echo "<h1>สวัสดี</h1>" > index.html',
          "git status                     # เห็น index.html เป็น untracked",
          "git add index.html",
          'git commit -m "สร้างหน้าแรก"',
          "git log --oneline              # เห็น commit แรก",
        ) },
        { t: "p", x: "**`git add` กับ `git commit` ต่างกันอย่างไร** — `add` คือการเลือกว่าจะบันทึกอะไร (ใส่ตะกร้า) ส่วน `commit` คือการกดบันทึกจริงพร้อมใส่ข้อความ แยกสองขั้นเพื่อให้เลือกบันทึกเฉพาะบางไฟล์ได้ และแบ่งงานเป็น commit เล็กๆ ที่มีความหมาย" },
        { t: "p", x: "**เขียนข้อความ commit ให้ดี**" },
        { t: "ul", items: [
          "บอกว่า \"ทำอะไร\" และถ้าจำเป็นให้บอกว่า \"ทำไม\" เช่น `แก้ปุ่มส่งงานไม่ทำงานเมื่อไม่แนบรูป`",
          "หลีกเลี่ยงข้อความกว้างๆ อย่าง `แก้ไข`, `update`, `asdf` เพราะอีก 1 เดือนจะอ่านไม่รู้เรื่อง",
          "1 commit ควรทำเรื่องเดียว อย่ารวมการแก้สามเรื่องไว้ใน commit เดียว",
        ] },
      ],
    },
    {
      id: "s5",
      title: "5. ไฟล์ที่ไม่ควรเข้า Git: .gitignore",
      blocks: [
        { t: "p", x: "บางไฟล์ไม่ควรเก็บใน repository เช่น ไลบรารีที่ดาวน์โหลดได้ใหม่ (`node_modules/`) และไฟล์ที่มี **ความลับ** (`.env`) ให้สร้างไฟล์ชื่อ `.gitignore` ในโฟลเดอร์โปรเจกต์ แล้วเขียนชื่อไฟล์/โฟลเดอร์ที่ต้องการให้ Git ข้าม" },
        { t: "code", lang: "text", x: L("# .gitignore", "node_modules/", ".env", "*.log") },
        { t: "note", kind: "warn", x: "ต้องสร้าง `.gitignore` **ก่อน** `git add` ครั้งแรก ถ้าไฟล์ลับถูก commit ไปแล้ว การเพิ่มชื่อใน `.gitignore` ทีหลังจะไม่ลบมันออกจากประวัติ ต้องเปลี่ยนรหัสผ่าน/คีย์นั้นทิ้งทันที" },
      ],
    },
    {
      id: "s6",
      title: "6. Branch: แตกกิ่งเพื่อทำงานแยกกัน",
      blocks: [
        { t: "p", x: "**Branch** คือเส้นทางการพัฒนาที่แยกออกมา ทำให้แก้ไขและทดลองได้โดยไม่กระทบโค้ดหลัก เมื่อเสร็จและตรวจแล้วค่อยรวม (merge) กลับ" },
        { t: "ul", items: [
          "**`main`** — โค้ดเวอร์ชันที่พร้อมใช้งานจริงเสมอ ห้ามแก้ตรงๆ ในงานทีม",
          "**`feature/ชื่อฟีเจอร์`** — กิ่งที่สมาชิกแต่ละคนแยกไปพัฒนา เช่น `feature/contact`",
        ] },
        { t: "code", lang: "bash", x: L(
          "git branch                     # ดู branch ทั้งหมด (ตัวที่มี * คือ branch ปัจจุบัน)",
          "git switch -c feature/contact  # สร้าง branch ใหม่และสลับไปทำงานทันที",
          "# ... แก้ไฟล์ แล้ว add / commit ตามปกติ ...",
          "git switch main                # กลับไป branch main",
          "git merge feature/contact      # รวมงานจาก feature/contact เข้า main",
          "git branch -d feature/contact  # ลบ branch ที่รวมแล้ว",
        ) },
        { t: "note", kind: "tip", x: "ก่อนสลับ branch ให้ commit งานที่ค้างให้เรียบร้อย ใช้ `git status` ตรวจเสมอว่าตอนนี้อยู่ branch ไหน ความผิดพลาดที่พบบ่อยคือเผลอทำงานบน `main`" },
      ],
    },
    {
      id: "s7",
      title: "7. เชื่อมกับ GitHub",
      blocks: [
        { t: "ol", items: [
          "บน GitHub กด **New repository** ตั้งชื่อ แล้ว Create (ยังไม่ต้องติ๊กเพิ่มไฟล์ใดๆ ถ้าจะส่งโปรเจกต์ที่มีอยู่แล้วขึ้นไป)",
          "ในเครื่อง ผูก repository กับ GitHub แล้วส่งขึ้น",
        ] },
        { t: "code", lang: "bash", x: L(
          "git remote add origin https://github.com/ชื่อผู้ใช้/ชื่อrepo.git",
          "git branch -M main",
          "git push -u origin main        # -u จำปลายทางไว้ ครั้งต่อไปพิมพ์แค่ git push",
        ) },
        { t: "note", kind: "info", x: "GitHub **ไม่รับรหัสผ่านปกติ** เวลา push ผ่าน HTTPS แล้ว Git for Windows ที่ติดตั้งมีตัว Git Credential Manager จะเปิดหน้าเว็บให้ล็อกอิน GitHub ครั้งเดียว หลังจากนั้นจะจำให้ ถ้าใช้ไม่ได้ให้สร้าง Personal Access Token ที่ GitHub Settings → Developer settings แล้วใช้เป็นรหัสผ่านแทน" },
      ],
    },
    {
      id: "s8",
      title: "8. ทำงานเป็นทีมด้วย GitHub Flow",
      blocks: [
        { t: "p", x: "**GitHub Flow** คือขั้นตอนทำงานเป็นทีมแบบเรียบง่ายที่ใช้กันแพร่หลาย ยึดหลักว่า `main` ต้องพร้อมใช้งานเสมอ และทุกการเปลี่ยนแปลงต้องผ่าน Pull Request" },
        { t: "ol", items: [
          "**สร้าง Issue** — บันทึกงานที่ต้องทำหรือบั๊กที่พบ (เช่น \"เพิ่มหน้า Contact\")",
          "**แตก branch** จาก `main` ตั้งชื่อสื่อความหมาย เช่น `feature/contact`",
          "**ทำงานและ commit** เป็นก้อนเล็กๆ บน branch นั้น แล้ว `git push` ขึ้น GitHub",
          "**เปิด Pull Request (PR)** ขอรวมงานเข้า `main` พร้อมอธิบายว่าทำอะไร (อ้างอิง Issue ได้ เช่น `Closes #3`)",
          "**ให้เพื่อนตรวจ (Code Review)** แก้ตามคอมเมนต์",
          "**Merge** เมื่อได้รับการอนุมัติ แล้วลบ branch ทิ้ง",
        ] },
        { t: "table", head: ["", "GitHub Flow", "Git Flow (แบบย่อ)"], rows: [
          ["branch หลัก", "`main` อย่างเดียว", "`main` + `develop`"],
          ["branch งาน", "`feature/*` แตกจาก main", "`feature/*` แตกจาก develop"],
          ["เหมาะกับ", "ทีมเล็ก ส่งของบ่อย (เหมาะกับวิชานี้)", "โปรเจกต์ที่มีรอบ release ชัดเจน"],
        ] },
        { t: "p", x: "**Branch Protection** — ตั้งกฎป้องกัน `main` ที่ Settings → Branches ของ repository เช่น บังคับให้ต้องมี PR และต้องมีคน approve อย่างน้อย 1 คนก่อน merge จะกัน \"push ตรงเข้า main\" โดยไม่ผ่านใครตรวจ" },
      ],
    },
    {
      id: "s9",
      title: "9. Pull Request และ Code Review",
      blocks: [
        { t: "p", x: "**Pull Request** คือคำขอให้รวมโค้ดจาก branch หนึ่งเข้าอีก branch หนึ่ง พร้อมพื้นที่ให้ทีมอ่านโค้ด คอมเมนต์ และอนุมัติ ข้อดีคือ ช่วยจับข้อผิดพลาดก่อนถึง main, แลกเปลี่ยนความรู้ในทีม และมีประวัติว่าทำไมโค้ดถึงเปลี่ยน" },
        { t: "p", x: "**ผู้ตรวจ (Reviewer)** กดที่แท็บ Files changed แล้วเลือกได้ 3 แบบ" },
        { t: "ul", items: [
          "**Comment** — ให้ความเห็นเฉยๆ ยังไม่ตัดสิน",
          "**Approve** — อนุมัติ พร้อมรวม",
          "**Request changes** — ขอให้แก้ก่อน",
        ] },
        { t: "p", x: "**ตอน merge** GitHub มีให้เลือก 3 แบบ ในวิชานี้ใช้ **Merge commit** (ค่าเริ่มต้น) เป็นหลัก ส่วน **Squash and merge** คือยุบทุก commit ใน PR เป็นอันเดียว เหมาะเมื่อ commit ย่อยรกมาก" },
        { t: "note", kind: "tip", x: "เขียนคอมเมนต์รีวิวให้เป็น **ข้อเสนอแนะ** ไม่ใช่การตำหนิ เช่น \"ลองเปลี่ยนชื่อตัวแปร `x` เป็น `totalPrice` ไหม จะอ่านง่ายขึ้น\" แทนที่จะพูดว่า \"ชื่อตัวแปรแย่\"" },
      ],
    },
    {
      id: "s10",
      title: "10. Merge Conflict และการแก้ไข",
      blocks: [
        { t: "p", x: "**Merge Conflict** เกิดเมื่อสองคนแก้ **บรรทัดเดียวกันของไฟล์เดียวกัน** คนละแบบ Git ตัดสินใจเองไม่ได้ว่าจะเก็บฝั่งไหน จึงหยุดแล้วทำเครื่องหมายในไฟล์ให้คนเลือก" },
        { t: "code", lang: "html", x: L(
          "<<<<<<< HEAD",
          "<h1>ยินดีต้อนรับ</h1>",
          "=======",
          "<h1>สวัสดีครับ</h1>",
          ">>>>>>> feature/greeting",
        ) },
        { t: "ul", items: [
          "ส่วนระหว่าง `<<<<<<< HEAD` กับ `=======` คือฝั่ง **ปัจจุบัน** (branch ที่ merge เข้าไป)",
          "ส่วนระหว่าง `=======` กับ `>>>>>>>` คือฝั่ง **ที่เพิ่งมารวม** (branch ที่ merge มา)",
        ] },
        { t: "p", x: "**ขั้นตอนแก้**" },
        { t: "ol", items: [
          "เปิดไฟล์ที่มีเครื่องหมาย conflict (ดูรายชื่อด้วย `git status`) ตัดสินใจร่วมกับเพื่อนว่าจะเก็บฝั่งไหน หรือรวมทั้งสองฝั่ง",
          "แก้ไฟล์ให้เหลือข้อความสุดท้ายที่ต้องการ และ **ลบเครื่องหมาย** `<<<<<<<`, `=======`, `>>>>>>>` ออกให้หมด (ใน VS Code มีปุ่ม Accept Current / Accept Incoming / Accept Both ให้กด)",
          "`git add` ไฟล์นั้น แล้ว `git commit` เพื่อจบการ merge",
        ] },
        { t: "code", lang: "bash", x: L(
          "git switch main",
          "git merge feature/greeting     # เกิด conflict",
          "git status                     # ดูว่าไฟล์ไหนมี conflict",
          "# แก้ไฟล์ตามขั้นตอนด้านบน",
          "git add index.html",
          'git commit -m "แก้ conflict หัวข้อหน้าแรก"',
        ) },
        { t: "note", kind: "tip", x: "วิธีลด conflict: ดึงโค้ดล่าสุดจาก main บ่อยๆ (`git pull`), แตก branch เล็กๆ ที่ทำเสร็จเร็ว, และคุยกันในทีมว่าใครแก้ไฟล์ไหน" },
      ],
    },
    {
      id: "s11",
      title: "11. พลาดแล้วแก้อย่างไร",
      blocks: [
        { t: "table", head: ["สถานการณ์", "วิธีแก้"], rows: [
          ["แก้ไฟล์แล้วอยากทิ้งการแก้ (ยังไม่ add)", "`git restore ชื่อไฟล์`"],
          ["`git add` ไปแล้วแต่ยังไม่อยากบันทึก", "`git restore --staged ชื่อไฟล์`"],
          ["commit ไปแล้ว อยากย้อนผลของ commit นั้น", "`git revert <รหัส commit>` (สร้าง commit ใหม่ที่ย้อนให้ ปลอดภัยกับงานทีม)"],
          ["`git push` แล้วขึ้น rejected / fetch first", "มีคนส่งงานขึ้นไปก่อน ให้ `git pull` แล้วแก้ conflict (ถ้ามี) ก่อน push ใหม่"],
          ["เผลอ commit รหัสผ่านหรือไฟล์ `.env`", "**เปลี่ยนรหัส/คีย์ทันที** ลบไฟล์ออกจาก repo แล้วเพิ่มใน `.gitignore`"],
        ] },
        { t: "note", kind: "warn", x: "หลีกเลี่ยง `git push --force` บน branch ที่ใช้ร่วมกัน เพราะมันเขียนทับประวัติของคนอื่นได้ ถ้าไม่แน่ใจ ให้ถามครูหรือเพื่อนก่อนเสมอ" },
      ],
    },
  ],
  summary: [
    "**Git** บันทึกประวัติในเครื่อง ส่วน **GitHub** เก็บ repository บนคลาวด์และมีเครื่องมือทำงานเป็นทีม",
    "โค้ดเดินทางผ่าน Working Directory → Staging (`add`) → Local Repo (`commit`) → GitHub (`push`)",
    "`main` ต้องพร้อมใช้งานเสมอ งานใหม่ทำบน `feature/*` แล้วรวมผ่าน **Pull Request**",
    "**GitHub Flow**: Issue → branch → commit → PR → review → merge",
    "**Code Review** เขียนเป็นข้อเสนอแนะ ไม่ตำหนิ",
    "**Merge Conflict** แก้โดยเลือกเนื้อหาสุดท้าย ลบเครื่องหมาย conflict แล้ว `add` + `commit`",
    "ไม่ commit ความลับ ใช้ `.gitignore` และถ้าหลุดต้องเปลี่ยนรหัสทันที",
  ],
  terms: [
    ["repository", "ที่เก็บโปรเจกต์พร้อมประวัติการเปลี่ยนแปลงทั้งหมด (ย่อว่า repo)"],
    ["commit", "การบันทึกการเปลี่ยนแปลงหนึ่งครั้งลงประวัติ พร้อมข้อความอธิบาย"],
    ["staging area", "พื้นที่พักไฟล์ที่เลือกไว้ก่อนบันทึกเป็น commit"],
    ["branch", "เส้นทางการพัฒนาที่แยกออกมาจากโค้ดหลัก"],
    ["merge", "การรวมงานจาก branch หนึ่งเข้าอีก branch หนึ่ง"],
    ["remote / origin", "repository ที่อยู่บนเซิร์ฟเวอร์ (เช่น GitHub) โดย `origin` เป็นชื่อเริ่มต้น"],
    ["Pull Request", "คำขอให้รวมโค้ดจาก branch หนึ่งเข้าอีกอัน พร้อมให้ทีมตรวจและคอมเมนต์"],
    ["Code Review", "การที่เพื่อนร่วมทีมอ่านและตรวจโค้ดก่อนรวมเข้า main"],
    ["merge conflict", "ความขัดแย้งเมื่อสองคนแก้ตำแหน่งเดียวกันของไฟล์เดียวกันคนละแบบ"],
    [".gitignore", "ไฟล์ระบุรายชื่อไฟล์/โฟลเดอร์ที่ Git ต้องไม่ติดตาม"],
  ],
  questions: [
    "Version Control ช่วยแก้ปัญหาอะไรเมื่อทำงานเป็นทีม",
    "คำสั่ง git add กับ git commit ต่างกันอย่างไร",
    "Pull Request คืออะไร มีประโยชน์อย่างไรต่อคุณภาพโค้ด",
    "Merge Conflict เกิดขึ้นเมื่อใด และแก้ไขอย่างไร",
  ],
};
