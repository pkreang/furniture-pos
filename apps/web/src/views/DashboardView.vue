<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { fetchDashboard, type Dashboard } from "../api/reports";
import { useEventsStore } from "../stores/events";

const { t } = useI18n();
const events = useEventsStore();

const data = ref<Dashboard | null>(null);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  error.value = null;
  try {
    data.value = await fetchDashboard();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
}

// Live refresh: a sale/stock/delivery event elsewhere reloads the dashboard.
watch(() => events.tick, load);
onMounted(load);
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900">{{ t("dashboard") }}</h1>
    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>
    <div v-else-if="data" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card">
        <h3 class="text-sm font-semibold text-slate-500 mb-2">{{ t("today") }} — {{ t("sales") }}</h3>
        <p class="text-2xl font-bold text-slate-900">{{ data.todaySalesCount }} <span class="text-base font-normal text-slate-500">บิล</span></p>
        <p class="text-sm text-slate-600 mt-1">{{ data.todaySalesTotal.toLocaleString() }} บาท</p>
      </div>
      <div class="card">
        <h3 class="text-sm font-semibold text-slate-500 mb-2">{{ t("outstanding") }}</h3>
        <p class="text-2xl font-bold text-slate-900">{{ data.outstandingTotal.toLocaleString() }} <span class="text-base font-normal text-slate-500">บาท</span></p>
      </div>
      <div class="card">
        <h3 class="text-sm font-semibold text-slate-500 mb-2">{{ t("pendingDeliveries") }}</h3>
        <p class="text-2xl font-bold text-slate-900">{{ data.pendingDeliveries }}</p>
      </div>
      <div class="card">
        <h3 class="text-sm font-semibold text-slate-500 mb-2">{{ t("lowStock") }}</h3>
        <p class="text-2xl font-bold text-slate-900">{{ data.lowStockCount }}</p>
      </div>
    </div>
  </div>
</template>
