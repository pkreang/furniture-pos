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

watch(statusFilter, load);
onMounted(load);
</script>

<template>
  <section>
    <header>
      <h2>{{ t("deliveries") }}</h2>
      <RouterLink v-if="auth.hasPermission('delivery.manage')" to="/deliveries/new">
        + {{ t("book") }}
      </RouterLink>
    </header>
    <label>{{ t("status") }}
      <select v-model="statusFilter">
        <option value="">—</option>
        <option value="PENDING">PENDING</option>
        <option value="SCHEDULED">SCHEDULED</option>
        <option value="IN_TRANSIT">IN_TRANSIT</option>
        <option value="DELIVERED">DELIVERED</option>
        <option value="FAILED">FAILED</option>
        <option value="CANCELLED">CANCELLED</option>
      </select>
    </label>
    <p v-if="loading">…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <table v-else>
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
          <td><RouterLink :to="`/deliveries/${d.id}`">{{ d.sale?.number }}</RouterLink></td>
          <td>{{ d.zone?.name }}</td>
          <td>{{ d.status }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
