import { NextResponse } from "next/server";
import { appendAudit, createId, requireJsonActor, updateDatabase } from "@/lib/json-db";
import { normalizeText, parseDateInput } from "@/lib/normalization";
import { importStudentsSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = importStudentsSchema.parse(await request.json());
    const result = await updateDatabase((database) => {
      const actor = requireJsonActor(database);
      const now = new Date().toISOString();
      const importId = createId();
      if (input.mode === "replace") {
        for (const student of database.students) if (student.status === "ACTIVE") { student.status = "ARCHIVED"; student.updatedAt = now; }
        for (const item of database.classes) item.active = false;
      }
      const classesById = new Map(database.classes.map((item) => [item.id, item]));
      const keys = new Set(input.mode === "append" ? database.students.filter((student) => student.status === "ACTIVE").map((student) => `${student.normalizedName}|${student.dateOfBirth}|${normalizeText(classesById.get(student.classId)?.name ?? "Chưa phân lớp")}`) : []);
      let importedCount = 0;
      let skippedCount = 0;
      for (const [index, student] of input.students.entries()) {
        const className = student.className || "Chưa phân lớp";
        const parsedDate = parseDateInput(student.dateOfBirth);
        if (student.dateOfBirth && !parsedDate) throw new Error(`Ngày sinh không hợp lệ tại dòng dữ liệu ${index + 1}.`);
        const dateOfBirth = parsedDate?.toISOString().slice(0, 10) ?? "";
        const key = `${normalizeText(student.fullName)}|${dateOfBirth}|${normalizeText(className)}`;
        if (keys.has(key)) { skippedCount += 1; continue; }
        let schoolClass = database.classes.find((item) => item.name === className && item.schoolYear === "2026–2027");
        if (!schoolClass) {
          schoolClass = { id: createId(), name: className, schoolYear: "2026–2027", active: true, createdAt: now, updatedAt: now };
          database.classes.push(schoolClass);
        } else { schoolClass.active = true; schoolClass.updatedAt = now; }
        database.students.push({ id: createId(), ordinal: student.ordinal, fullName: student.fullName, normalizedName: normalizeText(student.fullName), dateOfBirth, gender: student.gender, phone: student.phone, note: student.note, classId: schoolClass.id, status: "ACTIVE", importId, createdAt: now, updatedAt: now });
        keys.add(key); importedCount += 1;
      }
      database.studentImports.push({ id: importId, fileName: input.fileName, mode: input.mode, sourceRowCount: input.students.length, importedCount, skippedCount, mapping: input.mapping, createdById: actor.id, createdAt: now });
      appendAudit(database, actor.id, "STUDENTS_IMPORTED", "student_import", importId, { mode: input.mode, importedCount, skippedCount, fileName: input.fileName });
      return { importId, importedCount, skippedCount };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể import danh sách." }, { status: 400 });
  }
}
