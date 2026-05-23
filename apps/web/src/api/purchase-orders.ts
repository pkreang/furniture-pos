import { apiGet, apiSend } from "./client";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PARTIALLY_RECEIVED"
  | "FULLY_RECEIVED"
  | "CANCELLED";

export interface PurchaseOrderItem {
  id: number;
  productId: number;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  lineTotal: number;
  product?: { id: number; sku: string; name: string };
}

export interface PurchaseOrder {
  id: number;
  code: string;
  supplierId: number;
  branchId: number;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate: string | null;
  receivedDate: string | null;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  notes: string | null;
  createdById: number;
  createdAt: string;
  items?: PurchaseOrderItem[];
  supplier?: { id: number; name: string };
  branch?: { id: number; name: string; code: string };
}

export interface PoInput {
  supplierId: number;
  branchId: number;
  expectedDate?: string;
  notes?: string;
  items: { productId: number; orderedQty: number; unitCost: number }[];
}

export interface PoFilters {
  status?: PurchaseOrderStatus;
  supplierId?: number;
  branchId?: number;
  q?: string;
}

export function fetchPurchaseOrders(filters: PoFilters = {}): Promise<PurchaseOrder[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.supplierId !== undefined) params.set("supplierId", String(filters.supplierId));
  if (filters.branchId !== undefined) params.set("branchId", String(filters.branchId));
  if (filters.q && filters.q.length > 0) params.set("q", filters.q);
  const q = params.toString();
  return apiGet<PurchaseOrder[]>(`/api/purchase-orders${q ? `?${q}` : ""}`);
}

export function fetchPurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiGet<PurchaseOrder>(`/api/purchase-orders/${id}`);
}

export function createPurchaseOrder(input: PoInput): Promise<PurchaseOrder> {
  return apiSend<PurchaseOrder>("POST", "/api/purchase-orders", input);
}

export function updatePurchaseOrder(id: number, input: PoInput): Promise<PurchaseOrder> {
  return apiSend<PurchaseOrder>("PATCH", `/api/purchase-orders/${id}`, input);
}

export function confirmPurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiSend<PurchaseOrder>("POST", `/api/purchase-orders/${id}/confirm`);
}

export function receivePurchaseOrder(
  id: number,
  items: { itemId: number; qty: number }[],
): Promise<PurchaseOrder> {
  return apiSend<PurchaseOrder>("POST", `/api/purchase-orders/${id}/receive`, { items });
}

export function cancelPurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiSend<PurchaseOrder>("POST", `/api/purchase-orders/${id}/cancel`);
}
