<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchQuotation, convertQuotation, type Quotation } from "../api/quotations";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const quotation = ref<Quotation | null>(null);
const error = ref<string | null>(null);
const busy = ref(false);

async function doConvert(): Promise<void> {
  if (!quotation.value) return;
  error.value = null;
  busy.value = true;
  try {
    const sale = await convertQuotation(quotation.value.id, [
      { method: "CASH", amount: quotation.value.subtotal },
    ]);
    router.push(`/sales/${sale.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "แปลงไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    quotation.value = await fetchQuotation(Number(route.params.id));
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>
    <template v-if="quotation">
      <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("quotation") }} {{ quotation.number }}</h1>
      <p class="mb-4 text-sm text-slate-700 dark:text-slate-300">{{ t("status") }}: <span class="badge bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{{ quotation.status }}</span></p>
      <div class="card overflow-x-auto mb-4">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t("products") }}</th><th>{{ t("quantity") }}</th>
              <th>{{ t("price") }}</th><th>{{ t("total") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in quotation.items ?? []" :key="item.id">
              <td>{{ item.productName }}</td>
              <td>{{ item.quantity }}</td>
              <td>{{ item.unitPrice.toLocaleString() }}</td>
              <td>{{ item.lineTotal.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mb-4 text-slate-800 dark:text-slate-200 font-semibold">{{ t("subtotal") }}: {{ quotation.subtotal.toLocaleString() }}</p>

      <div class="flex flex-wrap items-center gap-3">
        <button
          v-if="quotation.status === 'OPEN' && auth.hasPermission('quotations.manage')"
          type="button"
          :disabled="busy"
          class="btn-primary"
          @click="doConvert"
        >
          {{ t("convert") }}
        </button>
        <RouterLink
          v-else-if="quotation.convertedSaleId"
          :to="`/sales/${quotation.convertedSaleId}`"
          class="btn-secondary"
        >
          {{ t("receipt") }}
        </RouterLink>
        <RouterLink to="/quotations" class="btn-secondary">{{ t("cancel") }}</RouterLink>
      </div>
    </template>
  </div>
</template>
