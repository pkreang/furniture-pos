<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  fetchSalesOrder,
  confirmSalesOrder,
  deliverSalesOrder,
  cancelSalesOrder,
  type SalesOrder,
  type SalesOrderStatus,
} from "../api/sales-orders";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const auth = useAuthStore();

const so = ref<SalesOrder | null>(null);
const error = ref<string | null>(null);
const busy = ref(false);

function statusLabel(s: SalesOrderStatus): string {
  switch (s) {
    case "DRAFT":
      return t("soStatusDraft");
    case "CONFIRMED":
      return t("soStatusConfirmed");
    case "DELIVERED":
      return t("soStatusDelivered");
    case "CANCELLED":
      return t("soStatusCancelled");
  }
}

function statusBadgeClass(s: SalesOrderStatus): string {
  if (s === "DELIVERED") return "badge-success";
  if (s === "CONFIRMED") return "badge-warning";
  if (s === "CANCELLED") return "badge-danger";
  return "badge bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
}

const fullAddress = computed(() => {
  if (!so.value) return "";
  const parts = [
    so.value.addrLine1,
    so.value.addrMoo ? `หมู่ ${so.value.addrMoo}` : null,
    so.value.addrSoi ? `ซอย ${so.value.addrSoi}` : null,
    so.value.addrStreet ? `ถนน ${so.value.addrStreet}` : null,
    so.value.addrKwang,
    so.value.addrDistrict,
    so.value.addrProvince,
    so.value.addrPostal,
  ].filter((s) => s && s.length > 0);
  return parts.join(" ");
});

const hasBookingDetails = computed(() => {
  if (!so.value) return false;
  return Boolean(
    so.value.bookNo ||
      so.value.billingType ||
      fullAddress.value ||
      so.value.customerPhone2 ||
      so.value.deliveryType ||
      so.value.paymentTerm ||
      so.value.deliveryInfo,
  );
});

function paymentTermLabel(): string {
  if (!so.value?.paymentTerm) return "";
  switch (so.value.paymentTerm) {
    case "DEPOSIT":
      return t("paymentTermDeposit");
    case "FULL":
      return t("paymentTermFull");
    case "INSTALLMENT":
      return `${t("paymentTermInstallment")} ${so.value.installmentMonths ?? ""}`.trim();
  }
}

function methodLabel(m: string | null): string {
  switch (m) {
    case "CASH":
      return t("methodCash");
    case "TRANSFER":
      return t("methodTransfer");
    case "CREDIT_CARD":
      return t("methodCard");
    default:
      return "";
  }
}

function cardLabel(c: string | null): string {
  switch (c) {
    case "VISA":
      return t("cardVisa");
    case "MASTERCARD":
      return t("cardMaster");
    case "OTHER":
      return t("cardOther");
    default:
      return "";
  }
}

function deliveryTypeLabel(): string {
  switch (so.value?.deliveryType) {
    case "COMPANY":
      return t("deliveryTypeCompany");
    case "SELF_PICKUP":
      return t("deliveryTypeSelf");
    case "OTHER":
      return `${t("deliveryTypeOther")}${so.value.deliveryTypeOther ? `: ${so.value.deliveryTypeOther}` : ""}`;
    default:
      return "";
  }
}

async function load(): Promise<void> {
  try {
    so.value = await fetchSalesOrder(Number(route.params.id));
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
}

async function doConfirm(): Promise<void> {
  if (!so.value) return;
  busy.value = true;
  error.value = null;
  try {
    so.value = await confirmSalesOrder(so.value.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ยืนยันไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

async function doDeliver(): Promise<void> {
  if (!so.value) return;
  busy.value = true;
  error.value = null;
  try {
    so.value = await deliverSalesOrder(so.value.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ส่งของไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

async function doCancel(): Promise<void> {
  if (!so.value) return;
  busy.value = true;
  error.value = null;
  try {
    so.value = await cancelSalesOrder(so.value.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>
    <template v-if="so">
      <header class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {{ t("salesOrder") }} {{ so.code }}
          </h1>
          <p class="mt-1 text-sm text-slate-700 dark:text-slate-300">
            {{ t("status") }}:
            <span :class="statusBadgeClass(so.status)">{{ statusLabel(so.status) }}</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <a
            v-if="so.status !== 'DRAFT'"
            :href="`/sales-orders/${so.id}/print`"
            target="_blank"
            rel="noopener"
            class="btn-secondary"
          >
            {{ t("printBooking") }}
          </a>
          <template v-if="so.status === 'DRAFT'">
            <RouterLink
              v-if="auth.hasPermission('so.manage')"
              :to="`/sales-orders/${so.id}/edit`"
              class="btn-secondary"
            >
              {{ t("save") }}
            </RouterLink>
            <button
              v-if="auth.hasPermission('so.manage')"
              type="button"
              :disabled="busy"
              class="btn-primary"
              @click="doConfirm"
            >
              {{ t("confirm") }}
            </button>
            <button
              v-if="auth.hasPermission('so.manage')"
              type="button"
              :disabled="busy"
              class="btn-danger"
              @click="doCancel"
            >
              {{ t("cancel") }}
            </button>
          </template>
          <template v-else-if="so.status === 'CONFIRMED'">
            <button
              v-if="auth.hasPermission('so.fulfill')"
              type="button"
              :disabled="busy"
              class="btn-primary"
              @click="doDeliver"
            >
              {{ t("deliver") }}
            </button>
            <button
              v-if="auth.hasPermission('so.manage')"
              type="button"
              :disabled="busy"
              class="btn-danger"
              @click="doCancel"
            >
              {{ t("cancel") }}
            </button>
          </template>
        </div>
      </header>

      <div class="card mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <span class="text-slate-500 dark:text-slate-400">{{ t("customer") }}: </span>
          <span class="text-slate-800 dark:text-slate-200 font-medium">{{ so.customer?.name ?? "—" }}</span>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">{{ t("branches") }}: </span>
          <span class="text-slate-800 dark:text-slate-200 font-medium">{{ so.branch?.name ?? "—" }}</span>
        </div>
        <div v-if="so.bookNo">
          <span class="text-slate-500 dark:text-slate-400">{{ t("bookNo") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ so.bookNo }}</span>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">{{ t("orderDate") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ new Date(so.orderDate).toLocaleDateString() }}</span>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">{{ t("dueDate") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ so.dueDate ? new Date(so.dueDate).toLocaleDateString() : "—" }}</span>
        </div>
        <div v-if="so.deliveredDate">
          <span class="text-slate-500 dark:text-slate-400">{{ t("deliveredDate") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ new Date(so.deliveredDate).toLocaleDateString() }}</span>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">{{ t("deposit") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ so.deposit.toLocaleString() }}</span>
        </div>
        <div v-if="so.poRef">
          <span class="text-slate-500 dark:text-slate-400">{{ t("poRef") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ so.poRef }}</span>
        </div>
        <div v-if="so.quotation">
          <span class="text-slate-500 dark:text-slate-400">{{ t("quotation") }}: </span>
          <RouterLink
            :to="`/quotations/${so.quotation.id}`"
            class="text-indigo-600 hover:text-indigo-700"
          >
            {{ so.quotation.number }}
          </RouterLink>
        </div>
        <div v-if="so.customerPhone2">
          <span class="text-slate-500 dark:text-slate-400">{{ t("phone2") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ so.customerPhone2 }}</span>
        </div>
        <div v-if="so.billingType" class="md:col-span-2">
          <span class="text-slate-500 dark:text-slate-400">{{ t("billingType") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{
            so.billingType === "HEAD_OFFICE"
              ? t("headOffice")
              : `${t("branchOffice")}${so.billingBranchNo ? ` (${so.billingBranchNo})` : ""}`
          }}</span>
        </div>
        <div v-if="fullAddress" class="md:col-span-2">
          <span class="text-slate-500 dark:text-slate-400">{{ t("address") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ fullAddress }}</span>
        </div>
        <div v-if="so.notes" class="md:col-span-2">
          <span class="text-slate-500 dark:text-slate-400">{{ t("notes") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ so.notes }}</span>
        </div>
      </div>

      <div class="card overflow-x-auto mb-4">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t("products") }}</th>
              <th>{{ t("itemSize") }}</th>
              <th>{{ t("itemMaterials") }}</th>
              <th>{{ t("itemColor") }}</th>
              <th class="text-right">{{ t("quantity") }}</th>
              <th class="text-right">{{ t("price") }}</th>
              <th class="text-right">{{ t("discount") }}</th>
              <th class="text-right">{{ t("total") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in so.items ?? []" :key="it.id">
              <td>{{ it.product?.name ?? `#${it.productId}` }}</td>
              <td>{{ it.size ?? "—" }}</td>
              <td>{{ it.materials ?? "—" }}</td>
              <td>{{ it.color ?? "—" }}</td>
              <td class="text-right">{{ it.quantity }}</td>
              <td class="text-right">{{ it.unitPrice.toLocaleString() }}</td>
              <td class="text-right">{{ it.discount.toLocaleString() }}</td>
              <td class="text-right">{{ it.lineTotal.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasBookingDetails" class="card mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div v-if="so.deliveryType">
          <span class="text-slate-500 dark:text-slate-400">{{ t("deliveryType") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ deliveryTypeLabel() }}</span>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">{{ t("canShipImmediately") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ so.canShipImmediately ? t("yes") : t("no") }}</span>
        </div>
        <div v-if="so.paymentTerm">
          <span class="text-slate-500 dark:text-slate-400">{{ t("paymentTerm") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ paymentTermLabel() }}</span>
        </div>
        <div v-if="so.depositMethod">
          <span class="text-slate-500 dark:text-slate-400">{{ t("depositMethodSection") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">
            {{ methodLabel(so.depositMethod) }}
            <span v-if="so.depositMethod === 'CREDIT_CARD'"> ({{ cardLabel(so.depositCardType) }})</span>
          </span>
        </div>
        <div v-if="so.balanceMethod">
          <span class="text-slate-500 dark:text-slate-400">{{ t("balanceMethodSection") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">
            {{ methodLabel(so.balanceMethod) }}
            <span v-if="so.balanceMethod === 'CREDIT_CARD'"> ({{ cardLabel(so.balanceCardType) }})</span>
          </span>
        </div>
      </div>

      <div class="card mb-4 max-w-sm ml-auto">
        <div class="flex justify-between py-1 text-slate-700 dark:text-slate-300">
          <span>{{ t("subtotal") }}</span>
          <span>{{ so.subtotal.toLocaleString() }}</span>
        </div>
        <div v-if="so.discount > 0" class="flex justify-between py-1 text-slate-700 dark:text-slate-300">
          <span>{{ t("discount") }}</span>
          <span>-{{ so.discount.toLocaleString() }}</span>
        </div>
        <div class="flex justify-between py-1 text-slate-700 dark:text-slate-300">
          <span>{{ t("vatAmount") }}</span>
          <span>{{ so.vatAmount.toLocaleString() }}</span>
        </div>
        <div class="flex justify-between py-2 border-t border-slate-200 dark:border-slate-700 mt-1 font-semibold text-slate-900 dark:text-slate-100">
          <span>{{ t("total") }}</span>
          <span>{{ so.totalAmount.toLocaleString() }}</span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <RouterLink to="/sales-orders" class="btn-secondary">{{ t("cancel") }}</RouterLink>
      </div>
    </template>
  </div>
</template>
