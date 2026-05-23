import { apiGet, apiSend } from "./client";

export type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

export interface SalesOrderItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  product?: { id: number; sku: string; name: string };
}

export interface SalesOrder {
  id: number;
  code: string;
  customerId: number | null;
  branchId: number;
  status: SalesOrderStatus;
  orderDate: string;
  dueDate: string | null;
  deliveredDate: string | null;
  subtotal: number;
  discount: number;
  vatAmount: number;
  totalAmount: number;
  deposit: number;
  notes: string | null;
  quotationId: number | null;
  poRef: string | null;
  createdById: number;
  createdAt: string;
  items?: SalesOrderItem[];
  customer?: { id: number; name: string; phone: string } | null;
  branch?: { id: number; name: string; code: string };
  quotation?: { id: number; number: string } | null;
}

export interface SoInput {
  customerId?: number | null;
  branchId: number;
  dueDate?: string;
  deposit?: number;
  notes?: string;
  poRef?: string;
  discount?: number;
  items: { productId: number; quantity: number; unitPrice: number; discount?: number }[];
}

export interface SoFilters {
  status?: SalesOrderStatus;
  customerId?: number;
  branchId?: number;
  q?: string;
}

export interface ConvertQuotationToSoArgs {
  branchId?: number;
  dueDate?: string;
  deposit?: number;
  notes?: string;
  poRef?: string;
}

export function fetchSalesOrders(filters: SoFilters = {}): Promise<SalesOrder[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.customerId !== undefined) params.set("customerId", String(filters.customerId));
  if (filters.branchId !== undefined) params.set("branchId", String(filters.branchId));
  if (filters.q && filters.q.length > 0) params.set("q", filters.q);
  const q = params.toString();
  return apiGet<SalesOrder[]>(`/api/sales-orders${q ? `?${q}` : ""}`);
}

export function fetchSalesOrder(id: number): Promise<SalesOrder> {
  return apiGet<SalesOrder>(`/api/sales-orders/${id}`);
}

export function createSalesOrder(input: SoInput): Promise<SalesOrder> {
  return apiSend<SalesOrder>("POST", "/api/sales-orders", input);
}

export function updateSalesOrder(id: number, input: SoInput): Promise<SalesOrder> {
  return apiSend<SalesOrder>("PATCH", `/api/sales-orders/${id}`, input);
}

export function confirmSalesOrder(id: number): Promise<SalesOrder> {
  return apiSend<SalesOrder>("POST", `/api/sales-orders/${id}/confirm`);
}

export function deliverSalesOrder(id: number): Promise<SalesOrder> {
  return apiSend<SalesOrder>("POST", `/api/sales-orders/${id}/deliver`);
}

export function cancelSalesOrder(id: number): Promise<SalesOrder> {
  return apiSend<SalesOrder>("POST", `/api/sales-orders/${id}/cancel`);
}

export function convertQuotationToSo(
  quotationId: number,
  args: ConvertQuotationToSoArgs = {},
): Promise<SalesOrder> {
  return apiSend<SalesOrder>("POST", `/api/quotations/${quotationId}/convert-to-so`, args);
}
