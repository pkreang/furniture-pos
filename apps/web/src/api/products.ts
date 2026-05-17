import { apiGet, apiSend } from "./client";

export interface Product {
  id: number;
  sku: string;
  name: string;
  categoryId: number;
  basePrice: number;
  isSofa: boolean;
  isActive: boolean;
  category?: { name: string };
}

export interface ProductInput {
  sku: string;
  name: string;
  categoryId: number;
  basePrice: number;
  isSofa: boolean;
}

export interface SofaColor {
  id: number;
  name: string;
}

export interface SofaMaterial {
  id: number;
  key: string;
  name: string;
  priceMultiplierPct: number;
  colors: SofaColor[];
}

export function fetchProducts(categoryId?: number): Promise<Product[]> {
  const query = categoryId === undefined ? "" : `?categoryId=${categoryId}`;
  return apiGet<Product[]>(`/api/products${query}`);
}

export function createProduct(input: ProductInput): Promise<Product> {
  return apiSend<Product>("POST", "/api/products", input);
}

export function updateProduct(id: number, patch: Partial<ProductInput>): Promise<Product> {
  return apiSend<Product>("PATCH", `/api/products/${id}`, patch);
}

export function fetchSofaMaterials(): Promise<SofaMaterial[]> {
  return apiGet<SofaMaterial[]>("/api/sofa-materials");
}
