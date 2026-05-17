import { buildApp } from "./app.js";
import { prisma } from "./prisma.js";
import { loadConfig } from "./config.js";
import { startDailyReportSchedule } from "./reports/schedule.js";

const config = loadConfig();
const app = buildApp();

app
  .listen({ port: config.port, host: "0.0.0.0" })
  .then((address) => {
    console.log(`API listening on ${address}`);
    startDailyReportSchedule(prisma);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

/** Closes Fastify and Prisma cleanly so the container stops without dropping work. */
async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received — shutting down`);
  try {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error("error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
