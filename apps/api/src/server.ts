import { buildApp } from "./app.js";
import { prisma } from "./prisma.js";
import { startDailyReportSchedule } from "./reports/schedule.js";

const app = buildApp();
const port = Number(process.env.API_PORT ?? 3000);

app
  .listen({ port, host: "0.0.0.0" })
  .then((address) => {
    console.log(`API listening on ${address}`);
    startDailyReportSchedule(prisma);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
