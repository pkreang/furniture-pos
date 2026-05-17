<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  fetchSale,
  fetchSettings,
  voidSale,
  settleSale,
  type PaymentMethod,
  type Sale,
} from "../api/sales";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const auth = useAuthStore();

const sale = ref<Sale | null>(null);
const settings = ref<Record<string, string>>({});
const error = ref<string | null>(null);
const settleMethod = ref<PaymentMethod>("CASH");
const settleAmount = ref(0);

function money(n: number): string {
  return n.toLocaleString();
}

function print(): void {
  window.print();
}

async function load(): Promise<void> {
  const id = Number(route.params.id);
  sale.value = await fetchSale(id);
  settleAmount.value = sale.value.outstanding;
}

async function doVoid(): Promise<void> {
  if (!sale.value) return;
  const reason = window.prompt(t("reason")) ?? "";
  error.value = null;
  try {
    await voidSale(sale.value.id, reason);
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ";
  }
}

async function doSettle(): Promise<void> {
  if (!sale.value) return;
  error.value = null;
  try {
    await settleSale(sale.value.id, settleMethod.value, settleAmount.value);
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ชำระไม่สำเร็จ";
  }
}

onMounted(async () => {
  try {
    settings.value = await fetchSettings();
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
});
</script>

<template>
  <section class="receipt">
    <p v-if="error" class="error">{{ error }}</p>
    <article v-else-if="sale" class="paper">
      <p v-if="sale.status === 'VOIDED'" class="error">
        ** {{ t("voided") }} ** {{ sale.voidReason }}
      </p>
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
        <dt v-if="sale.outstanding">{{ t("outstanding") }}</dt>
        <dd v-if="sale.outstanding">{{ money(sale.outstanding) }}</dd>
        <dt>{{ t("vat") }} 7% (ในยอด)</dt><dd>{{ money(sale.vatAmount) }}</dd>
        <dt>ฐานภาษี</dt><dd>{{ money(sale.taxBase) }}</dd>
      </dl>

      <p v-if="sale.pointsEarned">{{ t("points") }}: +{{ sale.pointsEarned }}</p>
    </article>

    <p v-if="error" class="error no-print">{{ error }}</p>

    <div v-if="sale" class="no-print actions">
      <button type="button" @click="print">พิมพ์</button>

      <form
        v-if="sale.status === 'COMPLETED' && sale.outstanding > 0 && auth.hasPermission('sales.create')"
        @submit.prevent="doSettle"
      >
        <select v-model="settleMethod">
          <option value="CASH">เงินสด</option>
          <option value="TRANSFER">โอนเงิน</option>
          <option value="CARD">บัตร</option>
        </select>
        <input v-model.number="settleAmount" type="number" min="1" :max="sale.outstanding" />
        <button type="submit">{{ t("settle") }}</button>
      </form>

      <button
        v-if="sale.status === 'COMPLETED' && auth.hasPermission('sales.void')"
        type="button"
        @click="doVoid"
      >
        {{ t("void") }}
      </button>
    </div>
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
