import { apiGet, apiSend } from "./client";

export interface Branch {
  id: number;
  name: string;
  code: string;
  isWarehouse: boolean;
}

export interface BranchInput {
  name: string;
  code: string;
  isWarehouse: boolean;
}

export function fetchBranches(): Promise<Branch[]> {
  return apiGet<Branch[]>("/api/branches");
}

export function createBranch(input: BranchInput): Promise<Branch> {
  return apiSend<Branch>("POST", "/api/branches", input);
}

export function updateBranch(id: number, patch: Partial<BranchInput>): Promise<Branch> {
  return apiSend<Branch>("PATCH", `/api/branches/${id}`, patch);
}
