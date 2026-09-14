import { NextResponse } from "next/server";
import { appendAudit, requireJsonActor, updateDatabase } from "@/lib/json-db";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await updateDatabase((database) => {
      const actor = requireJsonActor(database);
      const batch = database.transactionBatches.find((item) => item.id === id);
      if (!batch) throw new Error("Không tìm thấy batch.");
      const active = database.pointTransactions.filter((item) => item.batchId === id && item.status === "ACTIVE");
      if (!active.length) throw new Error("Batch này đã được hoàn tác.");
      const now = new Date().toISOString();
      for (const transaction of active) Object.assign(transaction, { status: "VOIDED", voidedAt: now, voidedById: actor.id, voidReason: "Hoàn tác batch", updatedAt: now });
      batch.status = "VOIDED"; batch.updatedAt = now;
      appendAudit(database, actor.id, "POINT_BATCH_VOIDED", "transaction_batch", id, { transactionCount: active.length });
      return { batchId: id, count: active.length };
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể hoàn tác." }, { status: 400 });
  }
}
