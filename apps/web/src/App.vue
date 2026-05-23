<script setup lang="ts">
import { computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "./stores/auth";
import { useEventsStore } from "./stores/events";
import { useThemeStore } from "./stores/theme";

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const events = useEventsStore();
const theme = useThemeStore();
const signedIn = computed(() => auth.user !== null);

// Open the real-time stream once the user is signed in.
watch(
  signedIn,
  (yes) => {
    if (yes) events.connect();
    else events.disconnect();
  },
  { immediate: true },
);

async function doLogout(): Promise<void> {
  await auth.logout();
  router.replace("/login");
}
</script>

<template>
  <div v-if="signedIn" class="flex h-screen bg-slate-50 dark:bg-slate-900">
    <aside class="w-60 bg-slate-800 text-slate-300 overflow-y-auto flex-shrink-0">
      <div class="p-4 border-b border-slate-700">
        <h1 class="text-white font-bold text-lg">{{ t("appName") }}</h1>
      </div>
      <nav class="p-2 space-y-4">
        <div>
          <div class="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {{ t("navSales") }}
          </div>
          <div class="space-y-1">
            <RouterLink
              v-if="auth.hasPermission('reports.view')"
              to="/dashboard"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("dashboard") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('sales.create')"
              to="/pos"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("pos") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('sales.view')"
              to="/sales"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("sales") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('sales.view')"
              to="/outstanding"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("outstanding") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('quotations.view')"
              to="/quotations"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("quotations") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('so.view')"
              to="/sales-orders"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("salesOrders") }}</RouterLink
            >
          </div>
        </div>
        <div>
          <div class="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {{ t("navDelivery") }}
          </div>
          <div class="space-y-1">
            <RouterLink
              v-if="auth.hasPermission('delivery.view')"
              to="/deliveries"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("deliveries") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('delivery.view')"
              to="/delivery-settings"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("deliverySettings") }}</RouterLink
            >
          </div>
        </div>
        <div>
          <div class="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {{ t("navCatalog") }}
          </div>
          <div class="space-y-1">
            <RouterLink
              v-if="auth.hasPermission('branches.view')"
              to="/branches"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("branches") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('catalog.view')"
              to="/categories"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("categories") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('catalog.view')"
              to="/products"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("products") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('stock.view')"
              to="/stock"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("stock") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('stock.view')"
              to="/transfers"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("transfers") }}</RouterLink
            >
          </div>
        </div>
        <div>
          <div class="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {{ t("navProcurement") }}
          </div>
          <div class="space-y-1">
            <RouterLink
              v-if="auth.hasPermission('suppliers.view')"
              to="/suppliers"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("suppliers") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('po.view')"
              to="/purchase-orders"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("purchaseOrders") }}</RouterLink
            >
          </div>
        </div>
        <div>
          <div class="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {{ t("navCustomers") }}
          </div>
          <div class="space-y-1">
            <RouterLink
              v-if="auth.hasPermission('customers.view')"
              to="/customers"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("customers") }}</RouterLink
            >
          </div>
        </div>
        <div>
          <div class="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {{ t("navReports") }}
          </div>
          <div class="space-y-1">
            <RouterLink
              v-if="auth.hasPermission('reports.view')"
              to="/z-reports"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("zReport") }}</RouterLink
            >
          </div>
        </div>
        <div>
          <div class="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {{ t("navAdmin") }}
          </div>
          <div class="space-y-1">
            <RouterLink
              v-if="auth.hasPermission('users.view')"
              to="/users"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("users") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('roles.view')"
              to="/roles"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("roles") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('settings.manage')"
              to="/settings"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("settings") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('audit.view')"
              to="/audit-log"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("auditLog") }}</RouterLink
            >
            <RouterLink
              v-if="auth.hasPermission('data.manage')"
              to="/import-export"
              class="block px-3 py-2 rounded text-sm hover:bg-slate-700 hover:text-white"
              active-class="bg-indigo-600 text-white"
              >{{ t("importExport") }}</RouterLink
            >
          </div>
        </div>
      </nav>
    </aside>
    <div class="flex-1 flex flex-col overflow-hidden">
      <header
        class="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0 dark:bg-slate-800 dark:border-slate-700"
      >
        <div></div>
        <div class="flex items-center gap-4">
          <span class="text-sm text-slate-600 dark:text-slate-300">{{ auth.user?.name }}</span>
          <button
            type="button"
            class="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition"
            :aria-label="t('toggleDarkMode')"
            :title="t('toggleDarkMode')"
            @click="theme.toggle"
          >
            <svg v-if="theme.isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
          <button type="button" class="btn-secondary text-sm" @click="doLogout">
            {{ t("logout") }}
          </button>
        </div>
      </header>
      <main class="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <RouterView />
      </main>
    </div>
  </div>
  <div v-else class="min-h-screen bg-slate-50 dark:bg-slate-900">
    <RouterView />
  </div>
</template>
