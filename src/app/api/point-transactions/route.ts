import { NextResponse } from "next/server";
import { appendAudit, createId, requireJsonActor, updateDatabase } from "@/lib/json-db";
import { createTransactionsSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = createTransactionsSchema.parse(await request.json());
    const result = await updateDatabase((database) => {
      const actor = requireJsonActor(database);
      let ruleTitle = "";
      let ruleCategory = "";
      let signedPoints = 0;
      let actualRuleId = "";
      
      if (input.ruleId) {
        const rule = database.pointRules.find((item) => item.id === input.ruleId && item.active);
        if (!rule) throw new Error("Quy tắc không tồn tại hoặc đã ngừng áp dụng.");
        actualRuleId = rule.id;
        ruleTitle = rule.title;
        ruleCategory = rule.category;
        signedPoints = rule.type === "CREDIT" ? rule.points : -rule.points;
      } else {
        if (!input.customTitle || !input.customPoints || input.customPoints <= 0) {
          throw new Error("Phải cung cấp tên việc làm tốt và điểm cộng hợp lệ.");
        }
        actualRuleId = "CUSTOM";
        ruleTitle = input.customTitle;
        ruleCategory = "Việc làm tốt (Tùy chỉnh)";
        signedPoints = input.customPoints;
      }

      const studentIds = [...new Set(input.studentIds)];
      const validIds = new Set(database.students.filter((student) => student.status === "ACTIVE" && studentIds.includes(student.id)).map((student) => student.id));
      if (validIds.size !== studentIds.length) throw new Error("Danh sách có học sinh không hợp lệ hoặc đã lưu trữ.");
      const now = new Date().toISOString();
      const batchId = createId();
      database.transactionBatches.push({ id: batchId, status: "ACTIVE", note: input.note, activityDate: input.activityDate, createdById: actor.id, createdAt: now, updatedAt: now });
      for (const studentId of studentIds) database.pointTransactions.push({ id: createId(), batchId, studentId, ruleId: actualRuleId, points: signedPoints, ruleTitle, ruleCategory, activityDate: input.activityDate, note: input.note, status: "ACTIVE", recordedById: actor.id, voidedById: "", voidedAt: "", voidReason: "", createdAt: now, updatedAt: now });
      appendAudit(database, actor.id, "POINT_BATCH_CREATED", "transaction_batch", batchId, { ruleId: actualRuleId, studentCount: studentIds.length, pointsPerStudent: signedPoints });
      return { batchId, count: studentIds.length, points: signedPoints, ruleTitle };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể ghi nhận điểm." }, { status: 400 });
  }
}
