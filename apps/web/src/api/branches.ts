import { apiGet } from "./client";

export interface Branch {
  id: number;
  name: string;
  code: string;
  isWarehouse: boolean;
}

export function fetchBranches(): Promise<Branch[]> {
  return apiGet<Branch[]>("/api/branches");
}
