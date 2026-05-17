import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "../stores/auth";
import LoginView from "../views/LoginView.vue";
import ChangePasswordView from "../views/ChangePasswordView.vue";
import BranchListView from "../views/BranchListView.vue";

const routes: RouteRecordRaw[] = [
  { path: "/login", name: "login", component: LoginView, meta: { public: true } },
  { path: "/change-password", name: "change-password", component: ChangePasswordView },
  { path: "/", redirect: "/branches" },
  { path: "/branches", name: "branches", component: BranchListView, meta: { permission: "branches.view" } },
  {
    path: "/branches/new",
    name: "branch-new",
    component: () => import("../views/BranchFormView.vue"),
    meta: { permission: "branches.manage" },
  },
  {
    path: "/branches/:id/edit",
    name: "branch-edit",
    component: () => import("../views/BranchFormView.vue"),
    meta: { permission: "branches.manage" },
  },
  {
    path: "/users",
    name: "users",
    component: () => import("../views/UserListView.vue"),
    meta: { permission: "users.view" },
  },
  {
    path: "/users/new",
    name: "user-new",
    component: () => import("../views/UserFormView.vue"),
    meta: { permission: "users.manage" },
  },
  {
    path: "/users/:id/edit",
    name: "user-edit",
    component: () => import("../views/UserFormView.vue"),
    meta: { permission: "users.manage" },
  },
  {
    path: "/roles",
    name: "roles",
    component: () => import("../views/RoleListView.vue"),
    meta: { permission: "roles.view" },
  },
  {
    path: "/roles/:id",
    name: "role-permissions",
    component: () => import("../views/RolePermissionsView.vue"),
    meta: { permission: "roles.view" },
  },
  {
    path: "/categories",
    name: "categories",
    component: () => import("../views/CategoryListView.vue"),
    meta: { permission: "catalog.view" },
  },
  {
    path: "/products",
    name: "products",
    component: () => import("../views/ProductListView.vue"),
    meta: { permission: "catalog.view" },
  },
  {
    path: "/products/new",
    name: "product-new",
    component: () => import("../views/ProductFormView.vue"),
    meta: { permission: "catalog.manage" },
  },
  {
    path: "/products/:id/edit",
    name: "product-edit",
    component: () => import("../views/ProductFormView.vue"),
    meta: { permission: "catalog.manage" },
  },
  {
    path: "/stock",
    name: "stock",
    component: () => import("../views/StockView.vue"),
    meta: { permission: "stock.view" },
  },
  {
    path: "/transfers",
    name: "transfers",
    component: () => import("../views/TransferView.vue"),
    meta: { permission: "stock.view" },
  },
  {
    path: "/customers",
    name: "customers",
    component: () => import("../views/CustomerListView.vue"),
    meta: { permission: "customers.view" },
  },
  {
    path: "/customers/new",
    name: "customer-new",
    component: () => import("../views/CustomerFormView.vue"),
    meta: { permission: "customers.manage" },
  },
  {
    path: "/customers/:id/edit",
    name: "customer-edit",
    component: () => import("../views/CustomerFormView.vue"),
    meta: { permission: "customers.manage" },
  },
  {
    path: "/customers/:id",
    name: "customer-detail",
    component: () => import("../views/CustomerDetailView.vue"),
    meta: { permission: "customers.view" },
  },
  {
    path: "/pos",
    name: "pos",
    component: () => import("../views/PosView.vue"),
    meta: { permission: "sales.create" },
  },
  {
    path: "/sales",
    name: "sales",
    component: () => import("../views/SalesListView.vue"),
    meta: { permission: "sales.view" },
  },
  {
    path: "/sales/:id",
    name: "receipt",
    component: () => import("../views/ReceiptView.vue"),
    meta: { permission: "sales.view" },
  },
  {
    path: "/outstanding",
    name: "outstanding",
    component: () => import("../views/OutstandingView.vue"),
    meta: { permission: "sales.view" },
  },
  {
    path: "/quotations",
    name: "quotations",
    component: () => import("../views/QuotationListView.vue"),
    meta: { permission: "quotations.view" },
  },
  {
    path: "/quotations/new",
    name: "quotation-new",
    component: () => import("../views/QuotationFormView.vue"),
    meta: { permission: "quotations.manage" },
  },
  {
    path: "/quotations/:id",
    name: "quotation-detail",
    component: () => import("../views/QuotationDetailView.vue"),
    meta: { permission: "quotations.view" },
  },
  {
    path: "/deliveries",
    name: "deliveries",
    component: () => import("../views/DeliveryListView.vue"),
    meta: { permission: "delivery.view" },
  },
  {
    path: "/deliveries/new",
    name: "delivery-new",
    component: () => import("../views/DeliveryFormView.vue"),
    meta: { permission: "delivery.manage" },
  },
  {
    path: "/deliveries/:id",
    name: "delivery-detail",
    component: () => import("../views/DeliveryDetailView.vue"),
    meta: { permission: "delivery.view" },
  },
  {
    path: "/delivery-settings",
    name: "delivery-settings",
    component: () => import("../views/DeliverySettingsView.vue"),
    meta: { permission: "delivery.view" },
  },
];

export const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.loadMe();

  if (to.meta.public) return true;
  if (!auth.user) return { name: "login" };
  if (auth.user.mustChangePassword && to.name !== "change-password") {
    return { name: "change-password" };
  }
  const permission = to.meta.permission as string | undefined;
  if (permission && !auth.hasPermission(permission)) return { path: "/" };
  return true;
});
