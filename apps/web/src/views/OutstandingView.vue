<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchOutstanding, type Sale } from "../api/sales";

const { t } = useI18n();
const sales = ref<Sale[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    sales.value = await fetchOutstanding();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("outstanding") }}</h1>
    <p v-if="loading" class="text-slate-500 dark:text-slate-400">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t("receipt") }}</th>
            <th>{{ t("customer") }}</th>
            <th>{{ t("total") }}</th>
            <th>{{ t("outstanding") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sales" :key="s.id">
            <td><RouterLink :to="`/sales/${s.id}`" class="text-indigo-600 hover:text-indigo-700 font-medium">{{ s.number }}</RouterLink></td>
            <td>{{ s.customer?.name ?? "—" }}</td>
            <td>{{ s.total.toLocaleString() }}</td>
            <td>{{ s.outstanding.toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
