import { apiGet, apiSend } from "./client";

export interface Dashboard {
  todaySalesCount: number;
  todaySalesTotal: number;
  outstandingTotal: number;
  pendingDeliveries: number;
  lowStockCount: number;
  salesByBranch: { branchId: number; name: string; total: number }[];
  topProducts: { productId: number; sku: string; name: string; qty: number; total: number }[];
  salesByMonth: { month: string; total: number }[];
}

export interface ZReport {
  id: number;
  branchId: number;
  businessDate: string;
  salesCount: number;
  grossTotal: number;
  vatTotal: number;
  discountTotal: number;
  cashTotal: number;
  transferTotal: number;
  cardTotal: number;
  voidedCount: number;
  voidedTotal: number;
  createdAt: string;
  branch?: { name: string; code: string };
}

export interface DailyReportEntry {
  id: number;
  channel: "EMAIL" | "LINE";
  status: "SENT" | "FAILED" | "SKIPPED";
  recipient: string | null;
  createdAt: string;
}

export const fetchDashboard = (): Promise<Dashboard> => apiGet("/api/dashboard");

export const fetchZReports = (): Promise<ZReport[]> => apiGet("/api/z-reports");

export const fetchZReport = (id: number): Promise<ZReport> => apiGet(`/api/z-reports/${id}`);

export const generateZReport = (branchId: number, businessDate: string): Promise<ZReport> =>
  apiSend("POST", "/api/z-reports", { branchId, businessDate });

export const runDailyReport = (): Promise<DailyReportEntry[]> =>
  apiSend("POST", "/api/daily-report/run");
