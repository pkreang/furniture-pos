<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  fetchZones,
  createZone,
  fetchChannels,
  createChannel,
  fetchTeams,
  createTeam,
  fetchDrivers,
  createDriver,
  type Zone,
  type Channel,
  type Team,
  type Driver,
} from "../api/delivery";
import { fetchBranches, type Branch } from "../api/branches";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();
const canManage = auth.hasPermission("delivery.manage");

const zones = ref<Zone[]>([]);
const channels = ref<Channel[]>([]);
const teams = ref<Team[]>([]);
const drivers = ref<Driver[]>([]);
const branches = ref<Branch[]>([]);
const error = ref<string | null>(null);

const zoneForm = ref({ name: "", fee: 0 });
const channelForm = ref({ name: "", type: "IN_HOUSE" as Channel["type"] });
const teamForm = ref({ name: "", branchId: 0 });
const driverForm = ref({ name: "", teamId: 0 });

async function load(): Promise<void> {
  [zones.value, channels.value, teams.value, drivers.value, branches.value] = await Promise.all([
    fetchZones(),
    fetchChannels(),
    fetchTeams(),
    fetchDrivers(),
    fetchBranches(),
  ]);
  if (branches.value[0]) teamForm.value.branchId = branches.value[0].id;
  if (teams.value[0]) driverForm.value.teamId = teams.value[0].id;
}

async function run(fn: () => Promise<unknown>): Promise<void> {
  error.value = null;
  try {
    await fn();
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}

onMounted(load);
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("deliverySettings") }}</h1>
    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="card">
        <h2 class="text-lg font-semibold mb-3 text-slate-800 dark:text-slate-200">{{ t("zone") }}</h2>
        <ul class="divide-y divide-slate-200 mb-4">
          <li v-for="z in zones" :key="z.id" class="py-2 text-sm text-slate-700 dark:text-slate-300">
            {{ z.name }} — <span class="text-slate-500 dark:text-slate-400">{{ t("fee") }} {{ z.fee }}</span>
          </li>
        </ul>
        <form v-if="canManage" class="flex flex-wrap items-end gap-2" @submit.prevent="run(() => createZone(zoneForm.name, zoneForm.fee))">
          <input v-model="zoneForm.name" :placeholder="t('zone')" class="input flex-1 min-w-[140px]" />
          <input v-model.number="zoneForm.fee" type="number" min="0" :placeholder="t('fee')" class="input w-28" />
          <button type="submit" class="btn-primary">{{ t("add") }}</button>
        </form>
      </div>

      <div class="card">
        <h2 class="text-lg font-semibold mb-3 text-slate-800 dark:text-slate-200">{{ t("channel") }}</h2>
        <ul class="divide-y divide-slate-200 mb-4">
          <li v-for="c in channels" :key="c.id" class="py-2 text-sm text-slate-700 dark:text-slate-300">{{ c.name }} <span class="text-slate-500 dark:text-slate-400">({{ c.type }})</span></li>
        </ul>
        <form v-if="canManage" class="flex flex-wrap items-end gap-2" @submit.prevent="run(() => createChannel(channelForm.name, channelForm.type))">
          <input v-model="channelForm.name" :placeholder="t('channel')" class="input flex-1 min-w-[140px]" />
          <select v-model="channelForm.type" class="input w-40">
            <option value="IN_HOUSE">IN_HOUSE</option>
            <option value="COURIER">COURIER</option>
          </select>
          <button type="submit" class="btn-primary">{{ t("add") }}</button>
        </form>
      </div>

      <div class="card">
        <h2 class="text-lg font-semibold mb-3 text-slate-800 dark:text-slate-200">{{ t("team") }}</h2>
        <ul class="divide-y divide-slate-200 mb-4">
          <li v-for="tm in teams" :key="tm.id" class="py-2 text-sm text-slate-700 dark:text-slate-300">{{ tm.name }}</li>
        </ul>
        <form v-if="canManage" class="flex flex-wrap items-end gap-2" @submit.prevent="run(() => createTeam(teamForm.name, teamForm.branchId))">
          <input v-model="teamForm.name" :placeholder="t('team')" class="input flex-1 min-w-[140px]" />
          <select v-model.number="teamForm.branchId" class="input w-40">
            <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
          <button type="submit" class="btn-primary">{{ t("add") }}</button>
        </form>
      </div>

      <div class="card">
        <h2 class="text-lg font-semibold mb-3 text-slate-800 dark:text-slate-200">{{ t("driver") }}</h2>
        <ul class="divide-y divide-slate-200 mb-4">
          <li v-for="d in drivers" :key="d.id" class="py-2 text-sm text-slate-700 dark:text-slate-300">
            {{ d.name }}<span v-if="!d.isActive" class="text-slate-500 dark:text-slate-400"> (ปิดใช้งาน)</span>
          </li>
        </ul>
        <form
          v-if="canManage && teams.length"
          class="flex flex-wrap items-end gap-2"
          @submit.prevent="run(() => createDriver(driverForm.name, driverForm.teamId))"
        >
          <input v-model="driverForm.name" :placeholder="t('driver')" class="input flex-1 min-w-[140px]" />
          <select v-model.number="driverForm.teamId" class="input w-40">
            <option v-for="tm in teams" :key="tm.id" :value="tm.id">{{ tm.name }}</option>
          </select>
          <button type="submit" class="btn-primary">{{ t("add") }}</button>
        </form>
      </div>
    </div>
  </div>
</template>
