import { apiGet, apiSend } from "./client";
import type { PaymentMethod, Sale } from "./sales";

export interface QuotationItem {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Quotation {
  id: number;
  number: string;
  branchId: number;
  customerId: number | null;
  status: "OPEN" | "CONVERTED";
  subtotal: number;
  note: string | null;
  convertedSaleId: number | null;
  createdAt: string;
  items?: QuotationItem[];
  branch?: { name: string; code: string };
  customer?: { name: string; phone: string } | null;
}

export interface QuotationInput {
  branchId: number;
  customerId?: number;
  items: { productId: number; quantity: number }[];
  note?: string;
}

export function fetchQuotations(): Promise<Quotation[]> {
  return apiGet<Quotation[]>("/api/quotations");
}

export function fetchQuotation(id: number): Promise<Quotation> {
  return apiGet<Quotation>(`/api/quotations/${id}`);
}

export function createQuotation(input: QuotationInput): Promise<Quotation> {
  return apiSend<Quotation>("POST", "/api/quotations", input);
}

export function convertQuotation(
  id: number,
  payments: { method: PaymentMethod; amount: number }[],
): Promise<Sale> {
  return apiSend<Sale>("POST", `/api/quotations/${id}/convert`, { payments });
}
