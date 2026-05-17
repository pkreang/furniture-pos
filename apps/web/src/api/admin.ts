import { apiGet, apiSend } from "./client";

export interface AuditEntry {
  id: number;
  userId: number | null;
  method: string;
  path: string;
  statusCode: number;
  createdAt: string;
  user: { username: string; name: string } | null;
}

export interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

export type ImportEntity = "products" | "customers" | "stock";

export const fetchSettings = (): Promise<Record<string, string>> => apiGet("/api/settings");

export const updateSettings = (
  settings: Record<string, string>,
): Promise<Record<string, string>> => apiSend("PUT", "/api/settings", settings);

export const fetchAuditLog = (): Promise<AuditEntry[]> => apiGet("/api/audit-log");

export const exportData = (entity: ImportEntity): Promise<Record<string, unknown>[]> =>
  apiGet(`/api/export/${entity}`);

export const importData = (
  entity: ImportEntity,
  rows: Record<string, unknown>[],
): Promise<ImportResult> => apiSend("POST", `/api/import/${entity}`, { rows });
