วางข้อความด้านล่างนี้ใน Claude Code เป็นข้อความแรก (หลังจาก cd เข้าโฟลเดอร์ iPlan แล้วพิมพ์ claude)

---

อ่าน CLAUDE.md และ docs/HANDOFF.md ให้ครบก่อน แล้วเข้า plan mode ยังไม่ต้องเขียนโค้ด

1. สรุปสิ่งที่เข้าใจเป็นภาษาไทยสั้นๆ
2. เสนอ stack, project structure, architecture พร้อม diagram (Mermaid) และเหตุผล โดยตอบ open decisions ใน HANDOFF §4 ด้วยคำแนะนำของคุณ
3. ลิสต์ว่าต้องสมัครบริการอะไร ฟรีจริงไหม อันไหนต้องผูกบัตร
4. แบ่งงานเป็น PR เล็กๆ ตามลำดับ (เช่น PR1 monorepo + tooling + README, PR2 db + api skeleton + auth, ...)

รอผมอนุมัติก่อนเริ่ม PR แรก ทุก PR ทำบน branch ใหม่และเปิด Pull Request เข้า https://github.com/tiphurin/iPlan ห้าม push เข้า main
