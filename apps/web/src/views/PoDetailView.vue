<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  fetchPurchaseOrder,
  confirmPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "../api/purchase-orders";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const auth = useAuthStore();

const po = ref<PurchaseOrder | null>(null);
const error = ref<string | null>(null);
const busy = ref(false);
const showReceivePanel = ref(false);
const receiveQtys = ref<Record<number, number>>({});

function statusLabel(s: PurchaseOrderStatus): string {
  switch (s) {
    case "DRAFT":
      return t("statusDraft");
    case "CONFIRMED":
      return t("statusConfirmed");
    case "PARTIALLY_RECEIVED":
      return t("statusPartiallyReceived");
    case "FULLY_RECEIVED":
      return t("statusFullyReceived");
    case "CANCELLED":
      return t("statusCancelled");
  }
}

function statusBadgeClass(s: PurchaseOrderStatus): string {
  if (s === "FULLY_RECEIVED") return "badge-success";
  if (s === "PARTIALLY_RECEIVED") return "badge-warning";
  if (s === "CANCELLED") return "badge-danger";
  return "badge bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
}

const hasAnyReceived = computed(
  () => po.value?.items?.some((i) => i.receivedQty > 0) ?? false,
);

const canReceive = computed(
  () =>
    !!po.value &&
    (po.value.status === "CONFIRMED" || po.value.status === "PARTIALLY_RECEIVED") &&
    auth.hasPermission("po.receive"),
);

const canCancel = computed(
  () =>
    !!po.value &&
    (po.value.status === "DRAFT" || po.value.status === "CONFIRMED") &&
    !hasAnyReceived.value &&
    auth.hasPermission("po.manage"),
);

async function load(): Promise<void> {
  try {
    po.value = await fetchPurchaseOrder(Number(route.params.id));
    receiveQtys.value = {};
    for (const it of po.value.items ?? []) {
      receiveQtys.value[it.id] = Math.max(0, it.orderedQty - it.receivedQty);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
}

function openReceive(): void {
  showReceivePanel.value = true;
}

async function doConfirm(): Promise<void> {
  if (!po.value) return;
  busy.value = true;
  error.value = null;
  try {
    po.value = await confirmPurchaseOrder(po.value.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ยืนยันไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

async function doReceive(): Promise<void> {
  if (!po.value) return;
  const entries = (po.value.items ?? [])
    .map((it) => ({ itemId: it.id, qty: Number(receiveQtys.value[it.id] || 0) }))
    .filter((e) => e.qty > 0);
  if (entries.length === 0) {
    error.value = t("receivedQty");
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    po.value = await receivePurchaseOrder(po.value.id, entries);
    showReceivePanel.value = false;
    receiveQtys.value = {};
    for (const it of po.value.items ?? []) {
      receiveQtys.value[it.id] = Math.max(0, it.orderedQty - it.receivedQty);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "รับของไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

async function doCancel(): Promise<void> {
  if (!po.value) return;
  busy.value = true;
  error.value = null;
  try {
    po.value = await cancelPurchaseOrder(po.value.id);
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
    <template v-if="po">
      <header class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {{ t("purchaseOrder") }} {{ po.code }}
          </h1>
          <p class="mt-1 text-sm text-slate-700 dark:text-slate-300">
            {{ t("status") }}:
            <span :class="statusBadgeClass(po.status)">{{ statusLabel(po.status) }}</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <template v-if="po.status === 'DRAFT'">
            <RouterLink
              v-if="auth.hasPermission('po.manage')"
              :to="`/purchase-orders/${po.id}/edit`"
              class="btn-secondary"
            >
              {{ t("save") }}
            </RouterLink>
            <button
              v-if="auth.hasPermission('po.manage')"
              type="button"
              :disabled="busy"
              class="btn-primary"
              @click="doConfirm"
            >
              {{ t("confirm") }}
            </button>
          </template>
          <button
            v-if="canReceive"
            type="button"
            :disabled="busy"
            class="btn-primary"
            @click="openReceive"
          >
            {{ t("receive") }}
          </button>
          <button
            v-if="canCancel"
            type="button"
            :disabled="busy"
            class="btn-danger"
            @click="doCancel"
          >
            {{ t("cancel") }}
          </button>
        </div>
      </header>

      <div class="card mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <span class="text-slate-500 dark:text-slate-400">{{ t("supplier") }}: </span>
          <span class="text-slate-800 dark:text-slate-200 font-medium">{{ po.supplier?.name ?? "—" }}</span>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">{{ t("branches") }}: </span>
          <span class="text-slate-800 dark:text-slate-200 font-medium">{{ po.branch?.name ?? "—" }}</span>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">{{ t("orderDate") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ new Date(po.orderDate).toLocaleDateString() }}</span>
        </div>
        <div>
          <span class="text-slate-500 dark:text-slate-400">{{ t("expectedDate") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : "—" }}</span>
        </div>
        <div v-if="po.receivedDate">
          <span class="text-slate-500 dark:text-slate-400">{{ t("receivedDate") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ new Date(po.receivedDate).toLocaleDateString() }}</span>
        </div>
        <div v-if="po.notes" class="md:col-span-2">
          <span class="text-slate-500 dark:text-slate-400">{{ t("notes") }}: </span>
          <span class="text-slate-800 dark:text-slate-200">{{ po.notes }}</span>
        </div>
      </div>

      <div class="card overflow-x-auto mb-4">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t("products") }}</th>
              <th class="text-right">{{ t("orderedQty") }}</th>
              <th class="text-right">{{ t("receivedQty") }}</th>
              <th class="text-right">{{ t("remainingQty") }}</th>
              <th class="text-right">{{ t("unitCost") }}</th>
              <th class="text-right">{{ t("total") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in po.items ?? []" :key="it.id">
              <td>{{ it.product?.name ?? `#${it.productId}` }}</td>
              <td class="text-right">{{ it.orderedQty }}</td>
              <td class="text-right">{{ it.receivedQty }}</td>
              <td class="text-right">{{ Math.max(0, it.orderedQty - it.receivedQty) }}</td>
              <td class="text-right">{{ it.unitCost.toLocaleString() }}</td>
              <td class="text-right">{{ it.lineTotal.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card mb-4 max-w-sm ml-auto">
        <div class="flex justify-between py-1 text-slate-700 dark:text-slate-300">
          <span>{{ t("subtotal") }}</span>
          <span>{{ po.subtotal.toLocaleString() }}</span>
        </div>
        <div class="flex justify-between py-1 text-slate-700 dark:text-slate-300">
          <span>{{ t("vatAmount") }}</span>
          <span>{{ po.vatAmount.toLocaleString() }}</span>
        </div>
        <div class="flex justify-between py-2 border-t border-slate-200 dark:border-slate-700 mt-1 font-semibold text-slate-900 dark:text-slate-100">
          <span>{{ t("total") }}</span>
          <span>{{ po.totalAmount.toLocaleString() }}</span>
        </div>
      </div>

      <div v-if="showReceivePanel && canReceive" class="card mb-4">
        <h2 class="font-semibold mb-3 text-slate-900 dark:text-slate-100">{{ t("receive") }}</h2>
        <table class="data-table mb-3">
          <thead>
            <tr>
              <th>{{ t("products") }}</th>
              <th class="text-right">{{ t("remainingQty") }}</th>
              <th class="w-32 text-right">{{ t("receivedQty") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in po.items ?? []" :key="it.id">
              <td>{{ it.product?.name ?? `#${it.productId}` }}</td>
              <td class="text-right">{{ Math.max(0, it.orderedQty - it.receivedQty) }}</td>
              <td class="text-right">
                <input
                  v-model.number="receiveQtys[it.id]"
                  type="number"
                  min="0"
                  :max="Math.max(0, it.orderedQty - it.receivedQty)"
                  class="input w-24 ml-auto"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <div class="flex items-center gap-3">
          <button type="button" :disabled="busy" class="btn-primary" @click="doReceive">
            {{ t("save") }}
          </button>
          <button type="button" class="btn-secondary" @click="showReceivePanel = false">
            {{ t("cancel") }}
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <RouterLink to="/purchase-orders" class="btn-secondary">{{ t("cancel") }}</RouterLink>
      </div>
    </template>
  </div>
</template>
