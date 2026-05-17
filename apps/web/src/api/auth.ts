import { apiGet, apiSend } from "./client";

export interface CurrentUser {
  id: number;
  username: string;
  name: string;
  roleKey: string;
  branchId: number | null;
  isBranchScoped: boolean;
  discountMaxPercent: number | null;
  permissions: string[];
  mustChangePassword: boolean;
}

export interface LoginResult {
  id: number;
  username: string;
  name: string;
  mustChangePassword: boolean;
}

export function login(username: string, password: string): Promise<LoginResult> {
  return apiSend<LoginResult>("POST", "/api/auth/login", { username, password });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("POST", "/api/auth/logout");
}

export function fetchMe(): Promise<CurrentUser> {
  return apiGet<CurrentUser>("/api/auth/me");
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("POST", "/api/auth/change-password", {
    currentPassword,
    newPassword,
  });
}
