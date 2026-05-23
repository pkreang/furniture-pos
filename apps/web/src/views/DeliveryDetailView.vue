<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  fetchDelivery,
  changeDeliveryStatus,
  type Delivery,
  type DeliveryStatus,
} from "../api/delivery";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const auth = useAuthStore();

const delivery = ref<Delivery | null>(null);
const error = ref<string | null>(null);

// Mirror of the server-side state machine — UX only; the API enforces it.
const TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "FAILED"],
  FAILED: ["SCHEDULED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

const nextStatuses = computed(() =>
  delivery.value ? TRANSITIONS[delivery.value.status] : [],
);

async function load(): Promise<void> {
  delivery.value = await fetchDelivery(Number(route.params.id));
}

async function move(to: DeliveryStatus): Promise<void> {
  if (!delivery.value) return;
  error.value = null;
  try {
    await changeDeliveryStatus(delivery.value.id, to);
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "เปลี่ยนสถานะไม่สำเร็จ";
  }
}

onMounted(async () => {
  try {
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>
    <template v-if="delivery">
      <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("delivery") }} — {{ delivery.sale?.number }}</h1>
      <div class="card mb-4">
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("status") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ delivery.status }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("zone") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ delivery.zone?.name }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("channel") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ delivery.channel?.name }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("team") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ delivery.team?.name ?? "—" }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("driver") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ delivery.driver?.name ?? "—" }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("scheduledDate") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ new Date(delivery.scheduledDate).toLocaleDateString() }}</dd></div>
          <div class="sm:col-span-2"><dt class="text-slate-500 dark:text-slate-400">{{ t("address") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ delivery.addressText }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("recipient") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ delivery.recipientName ?? "—" }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">{{ t("fee") }}</dt><dd class="text-slate-900 dark:text-slate-100 font-medium">{{ delivery.fee.toLocaleString() }}</dd></div>
        </dl>
      </div>

      <div v-if="auth.hasPermission('delivery.manage') && nextStatuses.length" class="flex flex-wrap gap-2 mb-4">
        <button v-for="s in nextStatuses" :key="s" type="button" class="btn-secondary" @click="move(s)">{{ s }}</button>
      </div>

      <h2 class="text-lg font-semibold mt-6 mb-3 text-slate-800 dark:text-slate-200">{{ t("status") }}</h2>
      <div class="card mb-4">
        <ol class="space-y-2">
          <li v-for="h in delivery.history ?? []" :key="h.id" class="text-sm text-slate-700 dark:text-slate-300">
            <span class="font-medium">{{ h.status }}</span> — {{ new Date(h.createdAt).toLocaleString() }}
            <span v-if="h.note" class="text-slate-500 dark:text-slate-400"> · {{ h.note }}</span>
          </li>
        </ol>
      </div>

      <RouterLink to="/deliveries" class="btn-secondary">{{ t("cancel") }}</RouterLink>
    </template>
  </div>
</template>
