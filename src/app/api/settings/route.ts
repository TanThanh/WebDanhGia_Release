import { NextResponse } from "next/server";
import { appendAudit, requireJsonActor, updateDatabase } from "@/lib/json-db";

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { capScore?: boolean; semester?: string };
    const settings = await updateDatabase((database) => {
      const actor = requireJsonActor(database);
      if (typeof body.capScore === "boolean") database.settings.app.capScore = body.capScore;
      if (body.semester === "Học kỳ I" || body.semester === "Học kỳ II") database.settings.app.semester = body.semester;
      database.settings.app.updatedAt = new Date().toISOString();
      appendAudit(database, actor.id, "SETTINGS_UPDATED", "setting", "app", body);
      return database.settings.app;
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể cập nhật cài đặt." }, { status: 400 });
  }
}
