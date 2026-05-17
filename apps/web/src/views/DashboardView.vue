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
  <section>
    <h2>{{ t("dashboard") }}</h2>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-else-if="data" class="cards">
      <div class="card">
        <h3>{{ t("today") }} — {{ t("sales") }}</h3>
        <p>{{ data.todaySalesCount }} บิล</p>
        <p>{{ data.todaySalesTotal.toLocaleString() }} บาท</p>
      </div>
      <div class="card">
        <h3>{{ t("outstanding") }}</h3>
        <p>{{ data.outstandingTotal.toLocaleString() }} บาท</p>
      </div>
      <div class="card">
        <h3>{{ t("pendingDeliveries") }}</h3>
        <p>{{ data.pendingDeliveries }}</p>
      </div>
      <div class="card">
        <h3>{{ t("lowStock") }}</h3>
        <p>{{ data.lowStockCount }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.card {
  border: 1px solid #ccc;
  padding: 1rem;
  min-width: 160px;
}
</style>
