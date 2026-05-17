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
