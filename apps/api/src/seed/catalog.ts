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

export const PERMISSIONS: PermissionDef[] = [
  { key: "users.view", description: "ดูรายชื่อผู้ใช้" },
  { key: "users.manage", description: "เพิ่ม/แก้ไข/ปิดบัญชีผู้ใช้" },
  { key: "roles.view", description: "ดูบทบาทและสิทธิ์" },
  { key: "roles.manage", description: "แก้ไขสิทธิ์ของบทบาท" },
  { key: "branches.view", description: "ดูรายชื่อสาขา" },
  { key: "branches.manage", description: "เพิ่ม/แก้ไขสาขา" },
];

const ALL = PERMISSIONS.map((p) => p.key);

export const ROLES: RoleDef[] = [
  { key: "owner", name: "เจ้าของ", isBranchScoped: false, discountMaxPercent: null, permissions: ALL },
  { key: "admin", name: "ผู้ดูแลระบบ", isBranchScoped: false, discountMaxPercent: null, permissions: ALL },
  { key: "manager", name: "ผู้จัดการสาขา", isBranchScoped: true, discountMaxPercent: 15, permissions: ["users.view", "branches.view"] },
  { key: "cashier", name: "พนักงานขาย", isBranchScoped: true, discountMaxPercent: 5, permissions: ["branches.view"] },
  { key: "account", name: "บัญชี", isBranchScoped: false, discountMaxPercent: 0, permissions: ["users.view", "branches.view"] },
];
