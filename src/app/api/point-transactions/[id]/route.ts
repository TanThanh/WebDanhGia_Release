import { NextResponse } from "next/server";
import { appendAudit, requireJsonActor, updateDatabase } from "@/lib/json-db";

// PATCH: Cập nhật số điểm hoặc nội dung của 1 transaction
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { points, ruleTitle, note } = body;

    const result = await updateDatabase((database) => {
      const actor = requireJsonActor(database);
      const transaction = database.pointTransactions.find((item) => item.id === id);
      if (!transaction) throw new Error("Không tìm thấy giao dịch.");
      if (transaction.status !== "ACTIVE") throw new Error("Giao dịch không còn hiệu lực.");

      const now = new Date().toISOString();
      const previous = { points: transaction.points, ruleTitle: transaction.ruleTitle, note: transaction.note };

      if (typeof points === "number") {
        transaction.points = points;
      }
      if (typeof ruleTitle === "string" && ruleTitle.trim()) {
        transaction.ruleTitle = ruleTitle.trim();
      }
      if (typeof note === "string") {
        transaction.note = note.trim();
      }
      transaction.updatedAt = now;

      appendAudit(database, actor.id, "POINT_TRANSACTION_UPDATED", "point_transaction", id, {
        previous,
        updated: { points: transaction.points, ruleTitle: transaction.ruleTitle, note: transaction.note }
      });

      return transaction;
    });

    return NextResponse.json({ success: true, transaction: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể cập nhật giao dịch." }, { status: 400 });
  }
}

// DELETE: Hủy (void/xóa) 1 transaction đơn lẻ
export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await updateDatabase((database) => {
      const actor = requireJsonActor(database);
      const transaction = database.pointTransactions.find((item) => item.id === id);
      if (!transaction) throw new Error("Không tìm thấy giao dịch.");
      if (transaction.status !== "ACTIVE") throw new Error("Giao dịch này đã được hoàn tác trước đó.");

      const now = new Date().toISOString();
      transaction.status = "VOIDED";
      transaction.voidedAt = now;
      transaction.voidedById = actor.id;
      transaction.voidReason = "Điều chỉnh / Xóa đơn lẻ";
      transaction.updatedAt = now;

      appendAudit(database, actor.id, "POINT_TRANSACTION_VOIDED", "point_transaction", id, {
        points: transaction.points,
        ruleTitle: transaction.ruleTitle
      });

      return { id, status: "VOIDED" };
    });

    return NextResponse.json({ success: true, transaction: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể hủy giao dịch." }, { status: 400 });
  }
}
