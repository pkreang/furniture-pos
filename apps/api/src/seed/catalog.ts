export interface PermissionDef {
  key: string;
  description: string;
}

export interface RoleDef {
  key: string;
  name: string;
  isBranchScoped: boolean;
  discountMaxPercent: number | null;
  permissions: string[];
}

export interface SofaMaterialDef {
  key: string;
  name: string;
  priceMultiplierPct: number;
  colors: string[];
}

export const PERMISSIONS: PermissionDef[] = [
  { key: "users.view", description: "ดูรายชื่อผู้ใช้" },
  { key: "users.manage", description: "เพิ่ม/แก้ไข/ปิดบัญชีผู้ใช้" },
  { key: "roles.view", description: "ดูบทบาทและสิทธิ์" },
  { key: "roles.manage", description: "แก้ไขสิทธิ์ของบทบาท" },
  { key: "branches.view", description: "ดูรายชื่อสาขา" },
  { key: "branches.manage", description: "เพิ่ม/แก้ไขสาขา" },
  { key: "catalog.view", description: "ดูสินค้าและหมวดหมู่" },
  { key: "catalog.manage", description: "เพิ่ม/แก้ไขสินค้าและหมวดหมู่" },
  { key: "stock.view", description: "ดูสต็อกสินค้า" },
  { key: "stock.adjust", description: "ปรับสต็อกและโอนสินค้าระหว่างสาขา" },
  { key: "customers.view", description: "ดูข้อมูลลูกค้า" },
  { key: "customers.manage", description: "เพิ่ม/แก้ไขลูกค้าและปรับแต้มสะสม" },
  { key: "suppliers.view", description: "ดูข้อมูลซัพพลายเออร์" },
  { key: "suppliers.manage", description: "เพิ่ม/แก้ไขซัพพลายเออร์" },
  { key: "sales.create", description: "ขายสินค้า (เปิดบิล)" },
  { key: "sales.view", description: "ดูประวัติการขาย" },
  { key: "sales.void", description: "ยกเลิกบิลและคืนเงิน" },
  { key: "quotations.view", description: "ดูใบเสนอราคา" },
  { key: "quotations.manage", description: "สร้างและแปลงใบเสนอราคา" },
  { key: "delivery.view", description: "ดูงานจัดส่ง" },
  { key: "delivery.manage", description: "จัดการงานจัดส่งและข้อมูลตั้งต้น" },
  { key: "reports.view", description: "ดูรายงานและแดชบอร์ด" },
  { key: "reports.generate", description: "ออก Z-report และส่งรายงานประจำวัน" },
  { key: "settings.manage", description: "แก้ไขการตั้งค่าระบบ" },
  { key: "audit.view", description: "ดูบันทึกการใช้งาน" },
  { key: "data.manage", description: "นำเข้า/ส่งออกข้อมูล" },
];

const ALL = PERMISSIONS.map((p) => p.key);

export const ROLES: RoleDef[] = [
  { key: "owner", name: "เจ้าของ", isBranchScoped: false, discountMaxPercent: null, permissions: ALL },
  { key: "admin", name: "ผู้ดูแลระบบ", isBranchScoped: false, discountMaxPercent: null, permissions: ALL },
  {
    key: "manager",
    name: "ผู้จัดการสาขา",
    isBranchScoped: true,
    discountMaxPercent: 15,
    permissions: [
      "users.view",
      "branches.view",
      "catalog.view",
      "stock.view",
      "stock.adjust",
      "customers.view",
      "customers.manage",
      "suppliers.view",
      "sales.create",
      "sales.view",
      "sales.void",
      "quotations.view",
      "quotations.manage",
      "delivery.view",
      "delivery.manage",
      "reports.view",
      "reports.generate",
    ],
  },
  {
    key: "cashier",
    name: "พนักงานขาย",
    isBranchScoped: true,
    discountMaxPercent: 5,
    permissions: [
      "branches.view",
      "catalog.view",
      "stock.view",
      "customers.view",
      "customers.manage",
      "sales.create",
      "sales.view",
      "quotations.view",
      "quotations.manage",
      "delivery.view",
      "delivery.manage",
      "reports.view",
      "reports.generate",
    ],
  },
  {
    key: "account",
    name: "บัญชี",
    isBranchScoped: false,
    discountMaxPercent: 0,
    permissions: [
      "users.view",
      "branches.view",
      "catalog.view",
      "stock.view",
      "customers.view",
      "suppliers.view",
      "sales.view",
      "quotations.view",
      "delivery.view",
      "reports.view",
    ],
  },
];

export const SOFA_MATERIALS: SofaMaterialDef[] = [
  { key: "economy", name: "ผ้าธรรมดา", priceMultiplierPct: 100, colors: ["เทา", "น้ำตาล", "ครีม"] },
  { key: "standard", name: "ผ้ากันน้ำ", priceMultiplierPct: 130, colors: ["เทาเข้ม", "น้ำเงิน", "เขียวมะกอก"] },
  { key: "premium", name: "หนังเทียม", priceMultiplierPct: 165, colors: ["ดำ", "น้ำตาลเข้ม", "ขาว"] },
  { key: "luxury", name: "หนังแท้", priceMultiplierPct: 210, colors: ["ดำเงา", "คอนยัค", "เบจ"] },
];

export const APP_SETTINGS: Record<string, string> = {
  "company.name": "เฟอร์นิเจอร์ เฮาส์ จำกัด",
  "company.taxId": "0000000000000",
  "company.address": "สำนักงานใหญ่ กรุงเทพมหานคร",
  "company.phone": "02-000-0000",
};
