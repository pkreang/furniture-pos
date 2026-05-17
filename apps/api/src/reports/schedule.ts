import type { PrismaClient } from "@prisma/client";
import cron from "node-cron";
import { runDailyReport } from "./daily.js";

/** Registers the nightly (22:00) daily-report job. Called from `server.ts`. */
export function startDailyReportSchedule(prisma: PrismaClient): void {
  cron.schedule("0 22 * * *", () => {
    runDailyReport(prisma, new Date()).catch((err) => {
      console.error("daily report failed:", err);
    });
  });
}
