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
  <section>
    <p v-if="error" class="error">{{ error }}</p>
    <template v-if="delivery">
      <h2>{{ t("delivery") }} — {{ delivery.sale?.number }}</h2>
      <dl>
        <dt>{{ t("status") }}</dt><dd>{{ delivery.status }}</dd>
        <dt>{{ t("zone") }}</dt><dd>{{ delivery.zone?.name }}</dd>
        <dt>{{ t("channel") }}</dt><dd>{{ delivery.channel?.name }}</dd>
        <dt>{{ t("team") }}</dt><dd>{{ delivery.team?.name ?? "—" }}</dd>
        <dt>{{ t("driver") }}</dt><dd>{{ delivery.driver?.name ?? "—" }}</dd>
        <dt>{{ t("scheduledDate") }}</dt><dd>{{ new Date(delivery.scheduledDate).toLocaleDateString() }}</dd>
        <dt>{{ t("address") }}</dt><dd>{{ delivery.addressText }}</dd>
        <dt>{{ t("recipient") }}</dt><dd>{{ delivery.recipientName ?? "—" }}</dd>
        <dt>{{ t("fee") }}</dt><dd>{{ delivery.fee.toLocaleString() }}</dd>
      </dl>

      <div v-if="auth.hasPermission('delivery.manage') && nextStatuses.length">
        <button v-for="s in nextStatuses" :key="s" type="button" @click="move(s)">{{ s }}</button>
      </div>

      <h3>{{ t("status") }}</h3>
      <ol>
        <li v-for="h in delivery.history ?? []" :key="h.id">
          {{ h.status }} — {{ new Date(h.createdAt).toLocaleString() }}
          <span v-if="h.note"> · {{ h.note }}</span>
        </li>
      </ol>

      <RouterLink to="/deliveries">{{ t("cancel") }}</RouterLink>
    </template>
  </section>
</template>
