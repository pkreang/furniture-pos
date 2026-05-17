import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import BranchListView from "../views/BranchListView.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/branches" },
  { path: "/branches", name: "branches", component: BranchListView },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
