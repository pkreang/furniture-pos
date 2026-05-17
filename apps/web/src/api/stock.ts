import { apiGet, apiSend } from "./client";

export interface StockLevel {
  productId: number;
  branchId: number;
  quantity: number;
  product: { sku: string; name: string };
  branch: { name: string; code: string };
}

export interface StockMovement {
  id: number;
  productId: number;
  branchId: number;
  delta: number;
  reason: string;
  note: string | null;
  createdAt: string;
  product: { sku: string; name: string };
  branch: { name: string; code: string };
}

export interface Transfer {
  id: number;
  productId: number;
  fromBranchId: number;
  toBranchId: number;
  quantity: number;
  note: string | null;
  createdAt: string;
  product: { sku: string; name: string };
  fromBranch: { name: string; code: string };
  toBranch: { name: string; code: string };
}

export interface AdjustInput {
  productId: number;
  branchId: number;
  delta: number;
  note?: string;
}

export interface TransferInput {
  productId: number;
  fromBranchId: number;
  toBranchId: number;
  quantity: number;
  note?: string;
}

export function fetchStock(): Promise<StockLevel[]> {
  return apiGet<StockLevel[]>("/api/stock");
}

export function fetchMovements(): Promise<StockMovement[]> {
  return apiGet<StockMovement[]>("/api/stock/movements");
}

export function adjustStock(input: AdjustInput): Promise<{ quantity: number }> {
  return apiSend<{ quantity: number }>("POST", "/api/stock/adjust", input);
}

export function fetchTransfers(): Promise<Transfer[]> {
  return apiGet<Transfer[]>("/api/transfers");
}

export function createTransfer(input: TransferInput): Promise<Transfer> {
  return apiSend<Transfer>("POST", "/api/transfers", input);
}
