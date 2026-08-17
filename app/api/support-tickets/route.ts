import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const CATEGORIES = new Set(["PAYMENT", "REWARD", "REPORT", "ACCOUNT", "OTHER"]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  const tickets = await prisma.supportTicket.findMany({
    where: { requesterId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, category: true, subject: true, status: true },
  });
  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    category?: string; subject?: string; message?: string;
  };
  const subject = body.subject?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  if (!body.category || !CATEGORIES.has(body.category)) {
    return NextResponse.json({ error: "お問い合わせ区分を選択してください" }, { status: 400 });
  }
  if (subject.length < 3 || subject.length > 100 || message.length < 10 || message.length > 5000) {
    return NextResponse.json({ error: "件名は3〜100文字、内容は10〜5,000文字で入力してください" }, { status: 400 });
  }
  const ticket = await prisma.supportTicket.create({
    data: { requesterId: user.id, category: body.category, subject, message },
    select: { id: true },
  });
  await prisma.eventLog.create({
    data: { type: "support_ticket_created", payload: { ticketId: ticket.id, requesterId: user.id } },
  });
  return NextResponse.json({ ok: true, ticketId: ticket.id });
}

export const dynamic = "force-dynamic";
