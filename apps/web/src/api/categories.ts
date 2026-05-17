import { apiGet, apiSend } from "./client";

export interface Category {
  id: number;
  name: string;
}

export function fetchCategories(): Promise<Category[]> {
  return apiGet<Category[]>("/api/categories");
}

export function createCategory(name: string): Promise<Category> {
  return apiSend<Category>("POST", "/api/categories", { name });
}

export function updateCategory(id: number, name: string): Promise<Category> {
  return apiSend<Category>("PATCH", `/api/categories/${id}`, { name });
}
