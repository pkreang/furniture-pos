import type { DeliveryStatus } from "@prisma/client";

/** Legal next statuses for each delivery status. `DELIVERED`/`CANCELLED` are terminal. */
export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "FAILED"],
  FAILED: ["SCHEDULED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to);
}
