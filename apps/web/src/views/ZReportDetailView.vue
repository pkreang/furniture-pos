<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchZReport, type ZReport } from "../api/reports";

const { t } = useI18n();
const route = useRoute();

const z = ref<ZReport | null>(null);
const error = ref<string | null>(null);

function money(n: number): string {
  return n.toLocaleString();
}

onMounted(async () => {
  try {
    z.value = await fetchZReport(Number(route.params.id));
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>
    <template v-if="z">
      <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("zReport") }} — {{ z.branch?.name }} {{ z.businessDate.slice(0, 10) }}</h1>
      <div class="card mb-4">
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("sales") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ z.salesCount }} บิล</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("total") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ money(z.grossTotal) }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("vat") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ money(z.vatTotal) }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("discount") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ money(z.discountTotal) }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">เงินสด</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ money(z.cashTotal) }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">โอนเงิน</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ money(z.transferTotal) }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">บัตร</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ money(z.cardTotal) }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("voided") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ z.voidedCount }} บิล / {{ money(z.voidedTotal) }}</dd></div>
        </dl>
      </div>
      <RouterLink to="/z-reports" class="btn-secondary">{{ t("cancel") }}</RouterLink>
    </template>
  </div>
</template>
