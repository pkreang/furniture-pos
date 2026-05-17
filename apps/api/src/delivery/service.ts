import type { Prisma, DeliveryStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { canTransition } from "./state.js";

/** Raised for any delivery rule violation; `code` is a stable error code. */
export class DeliveryError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const deliveryInclude = {
  history: { orderBy: { id: "asc" } },
  zone: true,
  channel: true,
  team: true,
  driver: true,
  sale: { select: { number: true, branchId: true } },
} satisfies Prisma.DeliveryInclude;

export type DeliveryResult = Prisma.DeliveryGetPayload<{ include: typeof deliveryInclude }>;

export interface CreateDeliveryArgs {
  saleId: number;
  zoneId: number;
  channelId: number;
  teamId?: number;
  driverId?: number;
  scheduledDate: Date;
  timeSlot?: string;
  addressText: string;
  recipientName?: string;
  recipientPhone?: string;
  note?: string;
  createdById?: number;
}

/**
 * Books a delivery for a sale: snapshots the zone fee, creates the delivery in
 * `PENDING`, and writes the initial status-history row — all in one transaction.
 */
export async function createDelivery(args: CreateDeliveryArgs): Promise<DeliveryResult> {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: args.saleId } });
    if (!sale) throw new DeliveryError("SALE_NOT_FOUND", "ไม่พบรายการขาย");
    if (sale.status === "VOIDED") {
      throw new DeliveryError("SALE_VOIDED", "บิลนี้ถูกยกเลิกแล้ว");
    }
    if (await tx.delivery.findUnique({ where: { saleId: args.saleId } })) {
      throw new DeliveryError("ALREADY_EXISTS", "บิลนี้มีงานจัดส่งอยู่แล้ว");
    }

    const zone = await tx.deliveryZone.findUnique({ where: { id: args.zoneId } });
    if (!zone) throw new DeliveryError("ZONE_NOT_FOUND", "ไม่พบโซนจัดส่ง");

    const delivery = await tx.delivery.create({
      data: {
        saleId: args.saleId,
        zoneId: args.zoneId,
        channelId: args.channelId,
        teamId: args.teamId,
        driverId: args.driverId,
        scheduledDate: args.scheduledDate,
        timeSlot: args.timeSlot,
        addressText: args.addressText,
        recipientName: args.recipientName,
        recipientPhone: args.recipientPhone,
        fee: zone.fee,
        note: args.note,
        history: { create: { status: "PENDING", changedById: args.createdById } },
      },
      include: deliveryInclude,
    });
    return delivery;
  });
}

/**
 * Moves a delivery to a new status, guarded by the state machine, appending a
 * status-history row.
 */
export async function changeDeliveryStatus(
  deliveryId: number,
  to: DeliveryStatus,
  changedById: number,
  note?: string,
): Promise<DeliveryResult> {
  return prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new DeliveryError("NOT_FOUND", "ไม่พบงานจัดส่ง");
    if (!canTransition(delivery.status, to)) {
      throw new DeliveryError(
        "INVALID_TRANSITION",
        `เปลี่ยนสถานะจาก ${delivery.status} เป็น ${to} ไม่ได้`,
      );
    }
    await tx.deliveryStatusHistory.create({
      data: { deliveryId, status: to, note, changedById },
    });
    return tx.delivery.update({
      where: { id: deliveryId },
      data: { status: to },
      include: deliveryInclude,
    });
  });
}
