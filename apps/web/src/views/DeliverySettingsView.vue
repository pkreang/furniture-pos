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
  <section>
    <h2>{{ t("deliverySettings") }}</h2>
    <p v-if="error" class="error">{{ error }}</p>

    <h3>{{ t("zone") }}</h3>
    <ul><li v-for="z in zones" :key="z.id">{{ z.name }} — {{ t("fee") }} {{ z.fee }}</li></ul>
    <form v-if="canManage" @submit.prevent="run(() => createZone(zoneForm.name, zoneForm.fee))">
      <input v-model="zoneForm.name" :placeholder="t('zone')" />
      <input v-model.number="zoneForm.fee" type="number" min="0" :placeholder="t('fee')" />
      <button type="submit">{{ t("add") }}</button>
    </form>

    <h3>{{ t("channel") }}</h3>
    <ul><li v-for="c in channels" :key="c.id">{{ c.name }} ({{ c.type }})</li></ul>
    <form v-if="canManage" @submit.prevent="run(() => createChannel(channelForm.name, channelForm.type))">
      <input v-model="channelForm.name" :placeholder="t('channel')" />
      <select v-model="channelForm.type">
        <option value="IN_HOUSE">IN_HOUSE</option>
        <option value="COURIER">COURIER</option>
      </select>
      <button type="submit">{{ t("add") }}</button>
    </form>

    <h3>{{ t("team") }}</h3>
    <ul><li v-for="tm in teams" :key="tm.id">{{ tm.name }}</li></ul>
    <form v-if="canManage" @submit.prevent="run(() => createTeam(teamForm.name, teamForm.branchId))">
      <input v-model="teamForm.name" :placeholder="t('team')" />
      <select v-model.number="teamForm.branchId">
        <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <button type="submit">{{ t("add") }}</button>
    </form>

    <h3>{{ t("driver") }}</h3>
    <ul>
      <li v-for="d in drivers" :key="d.id">
        {{ d.name }}<span v-if="!d.isActive"> (ปิดใช้งาน)</span>
      </li>
    </ul>
    <form
      v-if="canManage && teams.length"
      @submit.prevent="run(() => createDriver(driverForm.name, driverForm.teamId))"
    >
      <input v-model="driverForm.name" :placeholder="t('driver')" />
      <select v-model.number="driverForm.teamId">
        <option v-for="tm in teams" :key="tm.id" :value="tm.id">{{ tm.name }}</option>
      </select>
      <button type="submit">{{ t("add") }}</button>
    </form>
  </section>
</template>
