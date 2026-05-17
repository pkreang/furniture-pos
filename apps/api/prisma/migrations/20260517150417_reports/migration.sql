-- CreateEnum
CREATE TYPE "ReportChannel" AS ENUM ('EMAIL', 'LINE');

-- CreateEnum
CREATE TYPE "ReportSendStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "z_reports" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "business_date" DATE NOT NULL,
    "generated_by_id" INTEGER NOT NULL,
    "sales_count" INTEGER NOT NULL,
    "gross_total" INTEGER NOT NULL,
    "vat_total" INTEGER NOT NULL,
    "discount_total" INTEGER NOT NULL,
    "cash_total" INTEGER NOT NULL,
    "transfer_total" INTEGER NOT NULL,
    "card_total" INTEGER NOT NULL,
    "voided_count" INTEGER NOT NULL,
    "voided_total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "z_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_report_history" (
    "id" SERIAL NOT NULL,
    "channel" "ReportChannel" NOT NULL,
    "status" "ReportSendStatus" NOT NULL,
    "recipient" TEXT,
    "content" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_report_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "z_reports_branch_id_business_date_key" ON "z_reports"("branch_id", "business_date");

-- AddForeignKey
ALTER TABLE "z_reports" ADD CONSTRAINT "z_reports_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "z_reports" ADD CONSTRAINT "z_reports_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
