-- CreateEnum
CREATE TYPE "DeliveryChannelType" AS ENUM ('IN_HOUSE', 'COURIER');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_channels" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeliveryChannelType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_teams" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "team_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "zone_id" INTEGER NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "team_id" INTEGER,
    "driver_id" INTEGER,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "time_slot" TEXT,
    "address_text" TEXT NOT NULL,
    "recipient_name" TEXT,
    "recipient_phone" TEXT,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_status_history" (
    "id" SERIAL NOT NULL,
    "delivery_id" INTEGER NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "note" TEXT,
    "changed_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_name_key" ON "delivery_zones"("name");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_channels_name_key" ON "delivery_channels"("name");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_sale_id_key" ON "deliveries"("sale_id");

-- AddForeignKey
ALTER TABLE "delivery_teams" ADD CONSTRAINT "delivery_teams_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "delivery_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "delivery_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "delivery_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_status_history" ADD CONSTRAINT "delivery_status_history_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_status_history" ADD CONSTRAINT "delivery_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
