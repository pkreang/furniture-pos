import { apiGet, apiSend } from "./client";

export interface Supplier {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface SupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  notes?: string;
  isActive?: boolean;
}

export function fetchSuppliers(q?: string, active?: boolean): Promise<Supplier[]> {
  const params = new URLSearchParams();
  if (q && q.length > 0) params.set("q", q);
  if (active === true) params.set("active", "true");
  else if (active === false) params.set("active", "false");
  const query = params.toString();
  return apiGet<Supplier[]>(`/api/suppliers${query ? `?${query}` : ""}`);
}

export function fetchSupplier(id: number): Promise<Supplier> {
  return apiGet<Supplier>(`/api/suppliers/${id}`);
}

export function createSupplier(input: SupplierInput): Promise<Supplier> {
  return apiSend<Supplier>("POST", "/api/suppliers", input);
}

export function updateSupplier(id: number, patch: Partial<SupplierInput>): Promise<Supplier> {
  return apiSend<Supplier>("PATCH", `/api/suppliers/${id}`, patch);
}

export function deleteSupplier(id: number): Promise<{ ok: true }> {
  return apiSend<{ ok: true }>("DELETE", `/api/suppliers/${id}`);
}
