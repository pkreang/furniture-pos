import { apiGet, apiSend } from "./client";

export interface Role {
  id: number;
  key: string;
  name: string;
  isBranchScoped: boolean;
  discountMaxPercent: number | null;
  permissionKeys: string[];
}

export interface Permission {
  id: number;
  key: string;
  description: string;
}

export function fetchRoles(): Promise<Role[]> {
  return apiGet<Role[]>("/api/roles");
}

export function fetchPermissions(): Promise<Permission[]> {
  return apiGet<Permission[]>("/api/permissions");
}

export function updateRolePermissions(roleId: number, permissionKeys: string[]): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("PUT", `/api/roles/${roleId}/permissions`, { permissionKeys });
}
