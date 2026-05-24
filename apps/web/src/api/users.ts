import { apiGet, apiSend } from "./client";

export interface User {
  id: number;
  username: string;
  name: string;
  roleId: number;
  branchId: number | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface NewUser {
  username: string;
  name: string;
  password: string;
  roleId: number;
  branchId: number | null;
}

export function fetchUsers(): Promise<User[]> {
  return apiGet<User[]>("/api/users");
}

export function createUser(input: NewUser): Promise<User> {
  return apiSend<User>("POST", "/api/users", input);
}

export function updateUser(id: number, patch: Partial<Omit<User, "id" | "username">>): Promise<User> {
  return apiSend<User>("PATCH", `/api/users/${id}`, patch);
}

export function resetUserPassword(id: number, newPassword: string): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("POST", `/api/users/${id}/reset-password`, { newPassword });
}
