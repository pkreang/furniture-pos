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
  <section>
    <p v-if="error" class="error">{{ error }}</p>
    <template v-if="z">
      <h2>{{ t("zReport") }} — {{ z.branch?.name }} {{ z.businessDate.slice(0, 10) }}</h2>
      <dl>
        <dt>{{ t("sales") }}</dt><dd>{{ z.salesCount }} บิล</dd>
        <dt>{{ t("total") }}</dt><dd>{{ money(z.grossTotal) }}</dd>
        <dt>{{ t("vat") }}</dt><dd>{{ money(z.vatTotal) }}</dd>
        <dt>{{ t("discount") }}</dt><dd>{{ money(z.discountTotal) }}</dd>
        <dt>เงินสด</dt><dd>{{ money(z.cashTotal) }}</dd>
        <dt>โอนเงิน</dt><dd>{{ money(z.transferTotal) }}</dd>
        <dt>บัตร</dt><dd>{{ money(z.cardTotal) }}</dd>
        <dt>{{ t("voided") }}</dt><dd>{{ z.voidedCount }} บิล / {{ money(z.voidedTotal) }}</dd>
      </dl>
      <RouterLink to="/z-reports">{{ t("cancel") }}</RouterLink>
    </template>
  </section>
</template>
