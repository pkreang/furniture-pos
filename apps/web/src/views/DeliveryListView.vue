<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { fetchDeliveries, type Delivery, type DeliveryStatus } from "../api/delivery";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();

const deliveries = ref<Delivery[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);
const statusFilter = ref<DeliveryStatus | "">("");

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    deliveries.value = await fetchDeliveries(statusFilter.value || undefined);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function badgeClass(status: DeliveryStatus): string {
  if (status === "DELIVERED") return "badge-success";
  if (status === "IN_TRANSIT" || status === "SCHEDULED") return "badge-warning";
  if (status === "FAILED" || status === "CANCELLED") return "badge-danger";
  return "badge bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
}

watch(statusFilter, load);
onMounted(load);
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ t("deliveries") }}</h1>
      <RouterLink v-if="auth.hasPermission('delivery.manage')" to="/deliveries/new" class="btn-primary">
        + {{ t("book") }}
      </RouterLink>
    </header>
    <div class="card mb-4">
      <div class="form-row mb-0 max-w-xs">
        <label>{{ t("status") }}</label>
        <select v-model="statusFilter" class="input">
          <option value="">—</option>
          <option value="PENDING">PENDING</option>
          <option value="SCHEDULED">SCHEDULED</option>
          <option value="IN_TRANSIT">IN_TRANSIT</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="FAILED">FAILED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>
    </div>
    <p v-if="loading" class="text-slate-500 dark:text-slate-400">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t("scheduledDate") }}</th>
            <th>{{ t("receipt") }}</th>
            <th>{{ t("zone") }}</th>
            <th>{{ t("status") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in deliveries" :key="d.id">
            <td>{{ day(d.scheduledDate) }}</td>
            <td><RouterLink :to="`/deliveries/${d.id}`" class="text-indigo-600 hover:text-indigo-700 font-medium">{{ d.sale?.number }}</RouterLink></td>
            <td>{{ d.zone?.name }}</td>
            <td><span :class="badgeClass(d.status)">{{ d.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
