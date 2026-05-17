import { apiGet, apiSend } from "./client";

export interface Tier {
  key: string;
  name: string;
  minSpend: number;
}

export interface PointTransaction {
  id: number;
  delta: number;
  reason: string;
  note: string | null;
  createdAt: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  taxId: string | null;
  taxName: string | null;
  taxAddress: string | null;
  pointsBalance: number;
  lifetimeSpend: number;
  tier: Tier;
  pointTransactions?: PointTransaction[];
}

export interface CustomerInput {
  name: string;
  phone: string;
  email?: string;
  taxId?: string;
  taxName?: string;
  taxAddress?: string;
}

export function fetchCustomers(q?: string): Promise<Customer[]> {
  const query = q && q.length > 0 ? `?q=${encodeURIComponent(q)}` : "";
  return apiGet<Customer[]>(`/api/customers${query}`);
}

export function fetchCustomer(id: number): Promise<Customer> {
  return apiGet<Customer>(`/api/customers/${id}`);
}

export function createCustomer(input: CustomerInput): Promise<Customer> {
  return apiSend<Customer>("POST", "/api/customers", input);
}

export function updateCustomer(id: number, patch: Partial<CustomerInput>): Promise<Customer> {
  return apiSend<Customer>("PATCH", `/api/customers/${id}`, patch);
}

export function adjustPoints(
  id: number,
  delta: number,
  note?: string,
): Promise<{ customerId: number; pointsBalance: number }> {
  return apiSend("POST", `/api/customers/${id}/points`, { delta, note });
}
