import { NextResponse } from "next/server";
import { updateDatabase } from "@/lib/json-db";

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const input = await request.json();
    let updatedRule = null;

    await updateDatabase((database) => {
      const index = database.pointRules.findIndex(r => r.id === params.id);
      if (index === -1) throw new Error("Không tìm thấy quy tắc.");
      
      const rule = database.pointRules[index];
      if (input.title !== undefined) rule.title = input.title;
      if (input.points !== undefined) rule.points = input.points;
      
      updatedRule = rule;
    });

    return NextResponse.json({ success: true, rule: updatedRule });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lỗi server." }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    await updateDatabase((database) => {
      const index = database.pointRules.findIndex(r => r.id === params.id);
      if (index === -1) throw new Error("Không tìm thấy quy tắc.");
      
      // We can permanently delete or set active to false. Let's delete it completely.
      database.pointRules.splice(index, 1);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Lỗi server." }, { status: 500 });
  }
}
