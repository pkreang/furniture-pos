import type { PrismaClient, DailyReportHistory } from "@prisma/client";
import { sendEmail, sendLine } from "./notify.js";

export interface DailyReport {
  date: string;
  text: string;
}

/** UTC `[date, date + 24h)` window. */
function dayWindow(date: Date): { gte: Date; lt: Date } {
  const gte = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return { gte, lt: new Date(gte.getTime() + 24 * 60 * 60 * 1000) };
}

/** Builds the all-branches daily sales summary as a Thai text block. */
export async function buildDailyReport(prisma: PrismaClient, date: Date): Promise<DailyReport> {
  const window = dayWindow(date);
  const dateStr = window.gte.toISOString().slice(0, 10);
  const branches = await prisma.branch.findMany({ orderBy: { id: "asc" } });

  const lines: string[] = [`รายงานยอดขายประจำวัน ${dateStr}`];
  let grandTotal = 0;
  let grandCount = 0;
  for (const branch of branches) {
    const agg = await prisma.sale.aggregate({
      where: { branchId: branch.id, status: "COMPLETED", createdAt: window },
      _count: true,
      _sum: { total: true },
    });
    const total = agg._sum.total ?? 0;
    grandTotal += total;
    grandCount += agg._count;
    lines.push(`- ${branch.name}: ${agg._count} บิล, ${total.toLocaleString()} บาท`);
  }
  lines.push(`รวมทุกสาขา: ${grandCount} บิล, ${grandTotal.toLocaleString()} บาท`);

  return { date: dateStr, text: lines.join("\n") };
}

/**
 * Builds the daily report and sends it over Email and LINE, recording one
 * `daily_report_history` row per channel.
 */
export async function runDailyReport(
  prisma: PrismaClient,
  date: Date,
): Promise<DailyReportHistory[]> {
  const report = await buildDailyReport(prisma, date);
  const subject = `รายงานยอดขาย ${report.date}`;

  const email = await sendEmail(subject, report.text);
  const line = await sendLine(report.text);

  const rows: DailyReportHistory[] = [];
  rows.push(
    await prisma.dailyReportHistory.create({
      data: {
        channel: "EMAIL",
        status: email.status,
        recipient: email.recipient,
        content: report.text,
        error: email.error,
      },
    }),
  );
  rows.push(
    await prisma.dailyReportHistory.create({
      data: {
        channel: "LINE",
        status: line.status,
        recipient: line.recipient,
        content: report.text,
        error: line.error,
      },
    }),
  );
  return rows;
}
