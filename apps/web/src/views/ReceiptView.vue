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
  <div class="p-6 max-w-screen-xl mx-auto">
    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>
    <article
      v-else-if="sale"
      class="card max-w-md mx-auto font-mono text-sm print:shadow-none print:border-0 print:max-w-none"
    >
      <p v-if="sale.status === 'VOIDED'" class="text-red-600 font-bold mb-3">
        ** {{ t("voided") }} ** {{ sale.voidReason }}
      </p>
      <header class="text-center mb-3 pb-3 border-b border-slate-200">
        <h2 class="text-lg font-bold text-slate-900">{{ settings["company.name"] }}</h2>
        <p>{{ settings["company.address"] }}</p>
        <p>{{ t("taxId") }}: {{ settings["company.taxId"] }} · {{ settings["company.phone"] }}</p>
      </header>

      <p class="font-semibold mb-2">
        {{ sale.taxInvoice?.type === "FULL" ? t("taxInvoice") + " (เต็มรูป)" : t("taxInvoice") + "อย่างย่อ" }}
      </p>
      <p>{{ t("receipt") }}: <strong>{{ sale.number }}</strong></p>
      <p>{{ new Date(sale.createdAt).toLocaleString() }} · {{ sale.cashier?.name }}</p>

      <p v-if="sale.customer">{{ t("customer") }}: {{ sale.customer.name }}</p>
      <div v-if="sale.taxInvoice?.type === 'FULL'" class="mt-2 pt-2 border-t border-slate-200">
        <p>{{ t("taxName") }}: {{ sale.taxInvoice.customerTaxName }}</p>
        <p>{{ t("taxId") }}: {{ sale.taxInvoice.customerTaxId }}</p>
        <p>{{ t("taxAddress") }}: {{ sale.taxInvoice.customerTaxAddress }}</p>
      </div>

      <table class="data-table mt-3">
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

      <dl class="mt-3 grid grid-cols-2 gap-x-2 gap-y-1">
        <dt>{{ t("subtotal") }}</dt><dd class="text-right">{{ money(sale.subtotal) }}</dd>
        <dt>{{ t("discount") }}</dt><dd class="text-right">{{ money(sale.discountAmount) }}</dd>
        <dt v-if="sale.pointsRedeemed">{{ t("redeemPoints") }}</dt>
        <dd v-if="sale.pointsRedeemed" class="text-right">{{ money(sale.pointsRedeemed) }}</dd>
        <dt>{{ t("total") }}</dt><dd class="text-right"><strong>{{ money(sale.total) }}</strong></dd>
        <dt v-if="sale.outstanding">{{ t("outstanding") }}</dt>
        <dd v-if="sale.outstanding" class="text-right">{{ money(sale.outstanding) }}</dd>
        <dt>{{ t("vat") }} 7% (ในยอด)</dt><dd class="text-right">{{ money(sale.vatAmount) }}</dd>
        <dt>ฐานภาษี</dt><dd class="text-right">{{ money(sale.taxBase) }}</dd>
      </dl>

      <p v-if="sale.pointsEarned" class="mt-2">{{ t("points") }}: +{{ sale.pointsEarned }}</p>
    </article>

    <p v-if="error" class="text-red-600 mt-4 print:hidden">{{ error }}</p>

    <div v-if="sale" class="print:hidden mt-6 flex flex-wrap items-center gap-3">
      <button type="button" class="btn-secondary" @click="print">พิมพ์</button>

      <form
        v-if="sale.status === 'COMPLETED' && sale.outstanding > 0 && auth.hasPermission('sales.create')"
        class="flex flex-wrap items-center gap-2"
        @submit.prevent="doSettle"
      >
        <select v-model="settleMethod" class="input max-w-[160px]">
          <option value="CASH">เงินสด</option>
          <option value="TRANSFER">โอนเงิน</option>
          <option value="CARD">บัตร</option>
        </select>
        <input v-model.number="settleAmount" type="number" min="1" :max="sale.outstanding" class="input max-w-[160px]" />
        <button type="submit" class="btn-primary">{{ t("settle") }}</button>
      </form>

      <button
        v-if="sale.status === 'COMPLETED' && auth.hasPermission('sales.void')"
        type="button"
        class="btn-danger"
        @click="doVoid"
      >
        {{ t("void") }}
      </button>
    </div>
  </div>
</template>

<style>
/* Global: hide the app navigation while printing a receipt. */
@media print {
  aside,
  header.bg-white {
    display: none !important;
  }
}
</style>
