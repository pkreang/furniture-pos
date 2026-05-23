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
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("book") }}</h1>
    <div class="card max-w-3xl">
      <form @submit.prevent="submit">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-row">
            <label>{{ t("receipt") }}</label>
            <select v-model.number="form.saleId" class="input">
              <option v-for="s in sales" :key="s.id" :value="s.id">{{ s.number }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ t("zone") }}</label>
            <select v-model.number="form.zoneId" class="input">
              <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }} ({{ z.fee }})</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ t("channel") }}</label>
            <select v-model.number="form.channelId" class="input">
              <option v-for="c in channels" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ t("team") }}</label>
            <select v-model.number="form.teamId" class="input">
              <option :value="0">—</option>
              <option v-for="tm in teams" :key="tm.id" :value="tm.id">{{ tm.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ t("driver") }}</label>
            <select v-model.number="form.driverId" class="input">
              <option :value="0">—</option>
              <option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ t("scheduledDate") }}</label>
            <input v-model="form.scheduledDate" type="date" class="input" />
          </div>
          <div class="form-row md:col-span-2">
            <label>{{ t("address") }}</label>
            <input v-model="form.addressText" class="input" />
          </div>
          <div class="form-row">
            <label>{{ t("recipient") }}</label>
            <input v-model="form.recipientName" class="input" />
          </div>
          <div class="form-row">
            <label>{{ t("phone") }}</label>
            <input v-model="form.recipientPhone" class="input" />
          </div>
        </div>
        <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
        <div class="flex items-center gap-3">
          <button type="submit" :disabled="busy" class="btn-primary">{{ t("save") }}</button>
          <RouterLink to="/deliveries" class="btn-secondary">{{ t("cancel") }}</RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
