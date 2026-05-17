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
  <section>
    <p v-if="error" class="error">{{ error }}</p>
    <template v-if="quotation">
      <h2>{{ t("quotation") }} {{ quotation.number }}</h2>
      <p>{{ t("status") }}: {{ quotation.status }}</p>
      <table>
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
      <p>{{ t("subtotal") }}: {{ quotation.subtotal.toLocaleString() }}</p>

      <button
        v-if="quotation.status === 'OPEN' && auth.hasPermission('quotations.manage')"
        type="button"
        :disabled="busy"
        @click="doConvert"
      >
        {{ t("convert") }}
      </button>
      <RouterLink
        v-else-if="quotation.convertedSaleId"
        :to="`/sales/${quotation.convertedSaleId}`"
      >
        {{ t("receipt") }}
      </RouterLink>
      <RouterLink to="/quotations">{{ t("cancel") }}</RouterLink>
    </template>
  </section>
</template>
