import { NextResponse } from "next/server";
import { cronAuthorized, deliverServiceReminders } from "@/lib/notices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const result = await deliverServiceReminders();
    return NextResponse.json({ ok: true, date: result.date, sent: result.sent, failed: result.failed });
  } catch {
    console.error("reminder sheet read failed");
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
