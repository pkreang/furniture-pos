import { apiGet, apiSend } from "./client";

export type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "DELIVERED" | "CANCELLED";
export type BillingType = "HEAD_OFFICE" | "BRANCH";
export type SoDeliveryType = "COMPANY" | "SELF_PICKUP" | "OTHER";
export type PaymentTerm = "DEPOSIT" | "FULL" | "INSTALLMENT";
export type PaymentMethodKind = "CASH" | "TRANSFER" | "CREDIT_CARD";
export type CardType = "VISA" | "MASTERCARD" | "OTHER";

/** Structured delivery-survey answers captured on the SO. Free-form JSON
 * on the server side; the frontend layers strict typing on top. */
export interface DeliveryInfo {
  floor?: string;
  roomDoor?: string;
  preRoomDoor?: string;
  hasLift?: boolean;
  liftDoor?: string;
  liftInterior?: string;
  hasDoorBeforeLift?: boolean;
  doorBeforeLiftSize?: string;
  stair?: string;
  stairTurns?: boolean;
  stairTurnsSize?: string;
  ceilingHeight?: string;
  ceilingObstacles?: string;
}

export interface SalesOrderItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  size?: string | null;
  materials?: string | null;
  color?: string | null;
  product?: { id: number; sku: string; name: string };
}

export interface SalesOrder {
  id: number;
  code: string;
  customerId: number | null;
  branchId: number;
  status: SalesOrderStatus;
  orderDate: string;
  dueDate: string | null;
  deliveredDate: string | null;
  subtotal: number;
  discount: number;
  vatAmount: number;
  totalAmount: number;
  deposit: number;
  notes: string | null;
  quotationId: number | null;
  poRef: string | null;
  createdById: number;
  createdAt: string;
  // Booking-form fields
  bookNo: string | null;
  billingType: BillingType | null;
  billingBranchNo: string | null;
  customerPhone2: string | null;
  addrLine1: string | null;
  addrMoo: string | null;
  addrSoi: string | null;
  addrStreet: string | null;
  addrKwang: string | null;
  addrDistrict: string | null;
  addrProvince: string | null;
  addrPostal: string | null;
  canShipImmediately: boolean;
  deliveryType: SoDeliveryType | null;
  deliveryTypeOther: string | null;
  deliveryInfo: DeliveryInfo | null;
  paymentTerm: PaymentTerm | null;
  installmentMonths: number | null;
  depositMethod: PaymentMethodKind | null;
  depositCardType: CardType | null;
  balanceMethod: PaymentMethodKind | null;
  balanceCardType: CardType | null;
  items?: SalesOrderItem[];
  customer?: {
    id: number;
    name: string;
    phone: string;
    email?: string | null;
    taxId?: string | null;
    taxName?: string | null;
    taxAddress?: string | null;
  } | null;
  branch?: { id: number; name: string; code: string };
  quotation?: { id: number; number: string } | null;
}

export interface SoItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount?: number;
  size?: string | null;
  materials?: string | null;
  color?: string | null;
}

export interface SoInput {
  customerId?: number | null;
  branchId: number;
  dueDate?: string;
  deposit?: number;
  notes?: string;
  poRef?: string;
  discount?: number;
  items: SoItemInput[];
  bookNo?: string | null;
  billingType?: BillingType | null;
  billingBranchNo?: string | null;
  customerPhone2?: string | null;
  addrLine1?: string | null;
  addrMoo?: string | null;
  addrSoi?: string | null;
  addrStreet?: string | null;
  addrKwang?: string | null;
  addrDistrict?: string | null;
  addrProvince?: string | null;
  addrPostal?: string | null;
  canShipImmediately?: boolean;
  deliveryType?: SoDeliveryType | null;
  deliveryTypeOther?: string | null;
  deliveryInfo?: DeliveryInfo | null;
  paymentTerm?: PaymentTerm | null;
  installmentMonths?: number | null;
  depositMethod?: PaymentMethodKind | null;
  depositCardType?: CardType | null;
  balanceMethod?: PaymentMethodKind | null;
  balanceCardType?: CardType | null;
}

export interface SoFilters {
  status?: SalesOrderStatus;
  customerId?: number;
  branchId?: number;
  q?: string;
}

export interface ConvertQuotationToSoArgs {
  branchId?: number;
  dueDate?: string;
  deposit?: number;
  notes?: string;
  poRef?: string;
}

export function fetchSalesOrders(filters: SoFilters = {}): Promise<SalesOrder[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.customerId !== undefined) params.set("customerId", String(filters.customerId));
  if (filters.branchId !== undefined) params.set("branchId", String(filters.branchId));
  if (filters.q && filters.q.length > 0) params.set("q", filters.q);
  const q = params.toString();
  return apiGet<SalesOrder[]>(`/api/sales-orders${q ? `?${q}` : ""}`);
}

export function fetchSalesOrder(id: number): Promise<SalesOrder> {
  return apiGet<SalesOrder>(`/api/sales-orders/${id}`);
}

export function createSalesOrder(input: SoInput): Promise<SalesOrder> {
  return apiSend<SalesOrder>("POST", "/api/sales-orders", input);
}

export function updateSalesOrder(id: number, input: SoInput): Promise<SalesOrder> {
  return apiSend<SalesOrder>("PATCH", `/api/sales-orders/${id}`, input);
}

export function confirmSalesOrder(id: number): Promise<SalesOrder> {
  return apiSend<SalesOrder>("POST", `/api/sales-orders/${id}/confirm`);
}

export function deliverSalesOrder(id: number): Promise<SalesOrder> {
  return apiSend<SalesOrder>("POST", `/api/sales-orders/${id}/deliver`);
}

export function cancelSalesOrder(id: number): Promise<SalesOrder> {
  return apiSend<SalesOrder>("POST", `/api/sales-orders/${id}/cancel`);
}

export function convertQuotationToSo(
  quotationId: number,
  args: ConvertQuotationToSoArgs = {},
): Promise<SalesOrder> {
  return apiSend<SalesOrder>("POST", `/api/quotations/${quotationId}/convert-to-so`, args);
}
