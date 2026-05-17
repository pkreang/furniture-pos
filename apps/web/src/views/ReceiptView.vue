<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchSale, fetchSettings, type Sale } from "../api/sales";

const { t } = useI18n();
const route = useRoute();

const sale = ref<Sale | null>(null);
const settings = ref<Record<string, string>>({});
const error = ref<string | null>(null);

function money(n: number): string {
  return n.toLocaleString();
}

function print(): void {
  window.print();
}

onMounted(async () => {
  try {
    const id = Number(route.params.id);
    [sale.value, settings.value] = await Promise.all([fetchSale(id), fetchSettings()]);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
});
</script>

<template>
  <section class="receipt">
    <p v-if="error" class="error">{{ error }}</p>
    <article v-else-if="sale" class="paper">
      <header>
        <h2>{{ settings["company.name"] }}</h2>
        <p>{{ settings["company.address"] }}</p>
        <p>{{ t("taxId") }}: {{ settings["company.taxId"] }} · {{ settings["company.phone"] }}</p>
      </header>

      <p class="doc-type">
        {{ sale.taxInvoice?.type === "FULL" ? t("taxInvoice") + " (เต็มรูป)" : t("taxInvoice") + "อย่างย่อ" }}
      </p>
      <p>{{ t("receipt") }}: <strong>{{ sale.number }}</strong></p>
      <p>{{ new Date(sale.createdAt).toLocaleString() }} · {{ sale.cashier?.name }}</p>

      <p v-if="sale.customer">{{ t("customer") }}: {{ sale.customer.name }}</p>
      <div v-if="sale.taxInvoice?.type === 'FULL'" class="tax-block">
        <p>{{ t("taxName") }}: {{ sale.taxInvoice.customerTaxName }}</p>
        <p>{{ t("taxId") }}: {{ sale.taxInvoice.customerTaxId }}</p>
        <p>{{ t("taxAddress") }}: {{ sale.taxInvoice.customerTaxAddress }}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>{{ t("products") }}</th><th>{{ t("quantity") }}</th>
            <th>{{ t("price") }}</th><th>{{ t("total") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sale.items ?? []" :key="item.id">
            <td>{{ item.productName }}</td>
            <td>{{ item.quantity }}</td>
            <td>{{ money(item.unitPrice) }}</td>
            <td>{{ money(item.lineTotal) }}</td>
          </tr>
        </tbody>
      </table>

      <dl>
        <dt>{{ t("subtotal") }}</dt><dd>{{ money(sale.subtotal) }}</dd>
        <dt>{{ t("discount") }}</dt><dd>{{ money(sale.discountAmount) }}</dd>
        <dt v-if="sale.pointsRedeemed">{{ t("redeemPoints") }}</dt>
        <dd v-if="sale.pointsRedeemed">{{ money(sale.pointsRedeemed) }}</dd>
        <dt>{{ t("total") }}</dt><dd><strong>{{ money(sale.total) }}</strong></dd>
        <dt>{{ t("vat") }} 7% (ในยอด)</dt><dd>{{ money(sale.vatAmount) }}</dd>
        <dt>ฐานภาษี</dt><dd>{{ money(sale.taxBase) }}</dd>
      </dl>

      <p v-if="sale.pointsEarned">{{ t("points") }}: +{{ sale.pointsEarned }}</p>
    </article>

    <button class="no-print" type="button" @click="print">พิมพ์</button>
  </section>
</template>

<style scoped>
.paper {
  max-width: 360px;
  font-family: monospace;
}
@media print {
  .no-print {
    display: none;
  }
}
</style>

<style>
/* Global: hide the app navigation while printing a receipt. */
@media print {
  header nav {
    display: none;
  }
}
</style>
