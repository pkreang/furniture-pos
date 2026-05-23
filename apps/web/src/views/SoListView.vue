<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  fetchSalesOrders,
  type SalesOrder,
  type SalesOrderStatus,
} from "../api/sales-orders";
import { fetchCustomers, type Customer } from "../api/customers";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();

const orders = ref<SalesOrder[]>([]);
const customers = ref<Customer[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

const filterStatus = ref<SalesOrderStatus | "">("");
const filterCustomerId = ref<number | "">("");
const query = ref("");

const STATUSES: SalesOrderStatus[] = ["DRAFT", "CONFIRMED", "DELIVERED", "CANCELLED"];

function statusLabel(s: SalesOrderStatus): string {
  switch (s) {
    case "DRAFT":
      return t("soStatusDraft");
    case "CONFIRMED":
      return t("soStatusConfirmed");
    case "DELIVERED":
      return t("soStatusDelivered");
    case "CANCELLED":
      return t("soStatusCancelled");
  }
}

function statusBadgeClass(s: SalesOrderStatus): string {
  if (s === "DELIVERED") return "badge-success";
  if (s === "CONFIRMED") return "badge-warning";
  if (s === "CANCELLED") return "badge-danger";
  return "badge bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    orders.value = await fetchSalesOrders({
      status: filterStatus.value || undefined,
      customerId: typeof filterCustomerId.value === "number" ? filterCustomerId.value : undefined,
      q: query.value.trim() || undefined,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    customers.value = await fetchCustomers();
  } catch {
    /* non-fatal — dropdown will just be empty */
  }
  await load();
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ t("salesOrders") }}</h1>
      <RouterLink
        v-if="auth.hasPermission('so.manage')"
        to="/sales-orders/new"
        class="btn-primary"
      >
        + {{ t("salesOrder") }}
      </RouterLink>
    </header>
    <form class="card mb-4 flex flex-wrap items-end gap-3" @submit.prevent="load">
      <div class="form-row mb-0 min-w-[160px]">
        <label>{{ t("status") }}</label>
        <select v-model="filterStatus" class="input">
          <option value="">—</option>
          <option v-for="s in STATUSES" :key="s" :value="s">{{ statusLabel(s) }}</option>
        </select>
      </div>
      <div class="form-row mb-0 min-w-[200px]">
        <label>{{ t("customer") }}</label>
        <select v-model.number="filterCustomerId" class="input">
          <option :value="''">—</option>
          <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="form-row flex-1 mb-0 min-w-[200px]">
        <label>{{ t("salesOrder") }}</label>
        <input v-model="query" :placeholder="t('search')" class="input" />
      </div>
      <button type="submit" class="btn-secondary">{{ t("search") }}</button>
    </form>
    <p v-if="loading" class="text-slate-500 dark:text-slate-400">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t("salesOrder") }}</th>
            <th>{{ t("customer") }}</th>
            <th>{{ t("branches") }}</th>
            <th>{{ t("status") }}</th>
            <th>{{ t("orderDate") }}</th>
            <th>{{ t("dueDate") }}</th>
            <th class="text-right">{{ t("total") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="so in orders" :key="so.id">
            <td>
              <RouterLink
                :to="`/sales-orders/${so.id}`"
                class="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {{ so.code }}
              </RouterLink>
            </td>
            <td>{{ so.customer?.name ?? "—" }}</td>
            <td>{{ so.branch?.name ?? "—" }}</td>
            <td><span :class="statusBadgeClass(so.status)">{{ statusLabel(so.status) }}</span></td>
            <td>{{ new Date(so.orderDate).toLocaleDateString() }}</td>
            <td>{{ so.dueDate ? new Date(so.dueDate).toLocaleDateString() : "—" }}</td>
            <td class="text-right">{{ so.totalAmount.toLocaleString() }}</td>
          </tr>
          <tr v-if="orders.length === 0">
            <td colspan="7" class="text-center text-slate-500 dark:text-slate-400 py-6">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
