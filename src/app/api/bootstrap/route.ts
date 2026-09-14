import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/json-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const database = await getDatabase();
    const classesById = new Map(database.classes.map((item) => [item.id, item]));
    const studentsById = new Map(database.students.map((item) => [item.id, item]));
    return NextResponse.json({
      students: database.students.filter((student) => student.status === "ACTIVE").sort((a, b) => a.fullName.localeCompare(b.fullName, "vi")).map((student) => ({
        id: student.id, ordinal: student.ordinal, fullName: student.fullName, dateOfBirth: student.dateOfBirth,
        gender: student.gender, phone: student.phone, note: student.note, className: classesById.get(student.classId)?.name ?? "Chưa phân lớp",
      })),
      rules: database.pointRules.filter((rule) => rule.active).sort((a, b) => a.sortOrder - b.sortOrder),
      transactions: database.pointTransactions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5000).map((transaction) => {
        const student = studentsById.get(transaction.studentId);
        return { id: transaction.id, batchId: transaction.batchId, studentId: transaction.studentId, ruleId: transaction.ruleId, ruleTitle: transaction.ruleTitle, category: transaction.ruleCategory, points: transaction.points, activityDate: transaction.activityDate, note: transaction.note, status: transaction.status, createdAt: transaction.createdAt, studentName: student?.fullName ?? "Đã xóa", className: classesById.get(student?.classId ?? "")?.name ?? "Chưa phân lớp" };
      }),
      classes: database.classes.filter((item) => item.active).sort((a, b) => a.name.localeCompare(b.name, "vi")).map(({ id, name }) => ({ id, name })),
      settings: database.settings.app,
    });
  } catch {
    return NextResponse.json({ error: "Không thể đọc data/db.json. Hãy kiểm tra quyền ghi thư mục data." }, { status: 503 });
  }
}
