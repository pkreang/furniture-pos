-- CreateEnum
CREATE TYPE "PointTransactionReason" AS ENUM ('EARN', 'REDEEM', 'ADJUST');

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "tax_id" TEXT,
    "tax_name" TEXT,
    "tax_address" TEXT,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_spend" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transactions" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "PointTransactionReason" NOT NULL,
    "note" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
