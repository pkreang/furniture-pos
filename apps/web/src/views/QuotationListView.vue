<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchQuotations, type Quotation } from "../api/quotations";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();
const quotations = ref<Quotation[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    quotations.value = await fetchQuotations();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-slate-900">{{ t("quotations") }}</h1>
      <RouterLink v-if="auth.hasPermission('quotations.manage')" to="/quotations/new" class="btn-primary">
        + {{ t("quotation") }}
      </RouterLink>
    </header>
    <p v-if="loading" class="text-slate-500">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t("quotation") }}</th>
            <th>{{ t("customer") }}</th>
            <th>{{ t("subtotal") }}</th>
            <th>{{ t("status") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in quotations" :key="q.id">
            <td><RouterLink :to="`/quotations/${q.id}`" class="text-indigo-600 hover:text-indigo-700 font-medium">{{ q.number }}</RouterLink></td>
            <td>{{ q.customer?.name ?? "—" }}</td>
            <td>{{ q.subtotal.toLocaleString() }}</td>
            <td><span class="badge bg-slate-100 text-slate-700">{{ q.status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
