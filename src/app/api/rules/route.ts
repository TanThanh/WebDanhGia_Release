import { NextResponse } from "next/server";
import { updateDatabase } from "@/lib/json-db";

export async function POST(request: Request) {
  try {
    const input = await request.json();
    if (!input.title || typeof input.points !== "number") {
      return NextResponse.json({ error: "Thiếu tên quy tắc hoặc số điểm không hợp lệ." }, { status: 400 });
    }

    const type = (input.points > 0 ? "CREDIT" : "DEBIT") as "CREDIT" | "DEBIT";

    const newRule = await updateDatabase((database) => {
      // Auto-generate ID like "C001" or "D001"
      const prefix = type === "CREDIT" ? "C" : "D";
      const existingIds = database.pointRules
        .filter((r) => r.type === type && r.id.startsWith(prefix))
        .map((r) => parseInt(r.id.substring(1)) || 0);
      const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
      const newId = `${prefix}${(maxId + 1).toString().padStart(3, "0")}`;

      const rule = {
        id: newId,
        type,
        points: input.points,
        category: input.category || (type === "CREDIT" ? "Cộng điểm tùy chỉnh" : "Trừ điểm tùy chỉnh"),
        title: input.title,
        note: input.note || "",
        sourcePage: null,
        schoolYear: database.settings?.app?.schoolYear || "2026–2027",
        active: true,
        sortOrder: 999
      };

      database.pointRules.push(rule);
      return rule;
    });

    return NextResponse.json({ success: true, rule: newRule });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lỗi server." }, { status: 500 });
  }
}
