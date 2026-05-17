import { apiGet, apiSend } from "./client";

export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";

export interface SaleItem {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Payment {
  id: number;
  method: PaymentMethod;
  amount: number;
}

export interface TaxInvoice {
  type: "ABBREVIATED" | "FULL";
  customerTaxId: string | null;
  customerTaxName: string | null;
  customerTaxAddress: string | null;
}

export interface Sale {
  id: number;
  number: string;
  branchId: number;
  customerId: number | null;
  subtotal: number;
  discountAmount: number;
  pointsRedeemed: number;
  total: number;
  taxBase: number;
  vatAmount: number;
  pointsEarned: number;
  createdAt: string;
  items?: SaleItem[];
  payments?: Payment[];
  taxInvoice?: TaxInvoice | null;
  branch?: { name: string; code: string };
  customer?: { name: string; phone: string } | null;
  cashier?: { name: string; username: string };
  _count?: { items: number };
}

export interface CheckoutInput {
  branchId: number;
  customerId?: number;
  items: { productId: number; quantity: number }[];
  payments: { method: PaymentMethod; amount: number }[];
  discountPercent?: number;
  redeemPoints?: number;
}

export function checkout(input: CheckoutInput): Promise<Sale> {
  return apiSend<Sale>("POST", "/api/sales", input);
}

export function fetchSales(): Promise<Sale[]> {
  return apiGet<Sale[]>("/api/sales");
}

export function fetchSale(id: number): Promise<Sale> {
  return apiGet<Sale>(`/api/sales/${id}`);
}

export function fetchSettings(): Promise<Record<string, string>> {
  return apiGet<Record<string, string>>("/api/settings");
}
