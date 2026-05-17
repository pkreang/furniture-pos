<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  fetchZones,
  fetchChannels,
  fetchTeams,
  fetchDrivers,
  bookDelivery,
  type Zone,
  type Channel,
  type Team,
  type Driver,
} from "../api/delivery";
import { fetchSales, type Sale } from "../api/sales";

const { t } = useI18n();
const router = useRouter();

const sales = ref<Sale[]>([]);
const zones = ref<Zone[]>([]);
const channels = ref<Channel[]>([]);
const teams = ref<Team[]>([]);
const drivers = ref<Driver[]>([]);
const error = ref<string | null>(null);
const busy = ref(false);

const form = ref({
  saleId: 0,
  zoneId: 0,
  channelId: 0,
  teamId: 0,
  driverId: 0,
  scheduledDate: "",
  addressText: "",
  recipientName: "",
  recipientPhone: "",
});

async function submit(): Promise<void> {
  error.value = null;
  busy.value = true;
  try {
    const delivery = await bookDelivery({
      saleId: form.value.saleId,
      zoneId: form.value.zoneId,
      channelId: form.value.channelId,
      teamId: form.value.teamId || undefined,
      driverId: form.value.driverId || undefined,
      scheduledDate: new Date(form.value.scheduledDate).toISOString(),
      addressText: form.value.addressText,
      recipientName: form.value.recipientName || undefined,
      recipientPhone: form.value.recipientPhone || undefined,
    });
    router.push(`/deliveries/${delivery.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  [sales.value, zones.value, channels.value, teams.value, drivers.value] = await Promise.all([
    fetchSales(),
    fetchZones(),
    fetchChannels(),
    fetchTeams(),
    fetchDrivers(),
  ]);
  if (sales.value[0]) form.value.saleId = sales.value[0].id;
  if (zones.value[0]) form.value.zoneId = zones.value[0].id;
  if (channels.value[0]) form.value.channelId = channels.value[0].id;
});
</script>

<template>
  <section>
    <h2>{{ t("book") }}</h2>
    <form @submit.prevent="submit">
      <label>{{ t("receipt") }}
        <select v-model.number="form.saleId">
          <option v-for="s in sales" :key="s.id" :value="s.id">{{ s.number }}</option>
        </select>
      </label>
      <label>{{ t("zone") }}
        <select v-model.number="form.zoneId">
          <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }} ({{ z.fee }})</option>
        </select>
      </label>
      <label>{{ t("channel") }}
        <select v-model.number="form.channelId">
          <option v-for="c in channels" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label>{{ t("team") }}
        <select v-model.number="form.teamId">
          <option :value="0">—</option>
          <option v-for="tm in teams" :key="tm.id" :value="tm.id">{{ tm.name }}</option>
        </select>
      </label>
      <label>{{ t("driver") }}
        <select v-model.number="form.driverId">
          <option :value="0">—</option>
          <option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </label>
      <label>{{ t("scheduledDate") }}<input v-model="form.scheduledDate" type="date" /></label>
      <label>{{ t("address") }}<input v-model="form.addressText" /></label>
      <label>{{ t("recipient") }}<input v-model="form.recipientName" /></label>
      <label>{{ t("phone") }}<input v-model="form.recipientPhone" /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="busy">{{ t("save") }}</button>
      <RouterLink to="/deliveries">{{ t("cancel") }}</RouterLink>
    </form>
  </section>
</template>
