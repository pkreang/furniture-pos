<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  fetchPurchaseOrders,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "../api/purchase-orders";
import { fetchSuppliers, type Supplier } from "../api/suppliers";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();

const orders = ref<PurchaseOrder[]>([]);
const suppliers = ref<Supplier[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

const filterStatus = ref<PurchaseOrderStatus | "">("");
const filterSupplierId = ref<number | "">("");
const query = ref("");

const STATUSES: PurchaseOrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "FULLY_RECEIVED",
  "CANCELLED",
];

function statusLabel(s: PurchaseOrderStatus): string {
  switch (s) {
    case "DRAFT":
      return t("statusDraft");
    case "CONFIRMED":
      return t("statusConfirmed");
    case "PARTIALLY_RECEIVED":
      return t("statusPartiallyReceived");
    case "FULLY_RECEIVED":
      return t("statusFullyReceived");
    case "CANCELLED":
      return t("statusCancelled");
  }
}

function statusBadgeClass(s: PurchaseOrderStatus): string {
  if (s === "FULLY_RECEIVED") return "badge-success";
  if (s === "PARTIALLY_RECEIVED") return "badge-warning";
  if (s === "CANCELLED") return "badge-danger";
  return "badge bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    orders.value = await fetchPurchaseOrders({
      status: filterStatus.value || undefined,
      supplierId: typeof filterSupplierId.value === "number" ? filterSupplierId.value : undefined,
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
    suppliers.value = await fetchSuppliers();
  } catch {
    /* non-fatal — suppliers dropdown will just be empty */
  }
  await load();
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ t("purchaseOrders") }}</h1>
      <RouterLink
        v-if="auth.hasPermission('po.manage')"
        to="/purchase-orders/new"
        class="btn-primary"
      >
        + {{ t("purchaseOrder") }}
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
        <label>{{ t("supplier") }}</label>
        <select v-model.number="filterSupplierId" class="input">
          <option :value="''">—</option>
          <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>
      <div class="form-row flex-1 mb-0 min-w-[200px]">
        <label>{{ t("poNumber") }}</label>
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
            <th>{{ t("poNumber") }}</th>
            <th>{{ t("supplier") }}</th>
            <th>{{ t("branches") }}</th>
            <th>{{ t("status") }}</th>
            <th>{{ t("orderDate") }}</th>
            <th class="text-right">{{ t("total") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="po in orders" :key="po.id">
            <td>
              <RouterLink
                :to="`/purchase-orders/${po.id}`"
                class="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {{ po.code }}
              </RouterLink>
            </td>
            <td>{{ po.supplier?.name ?? "—" }}</td>
            <td>{{ po.branch?.name ?? "—" }}</td>
            <td><span :class="statusBadgeClass(po.status)">{{ statusLabel(po.status) }}</span></td>
            <td>{{ new Date(po.orderDate).toLocaleDateString() }}</td>
            <td class="text-right">{{ po.totalAmount.toLocaleString() }}</td>
          </tr>
          <tr v-if="orders.length === 0">
            <td colspan="6" class="text-center text-slate-500 dark:text-slate-400 py-6">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
