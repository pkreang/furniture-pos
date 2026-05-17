<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchZReports, generateZReport, type ZReport } from "../api/reports";
import { fetchBranches, type Branch } from "../api/branches";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();
const canGenerate = auth.hasPermission("reports.generate");

const reports = ref<ZReport[]>([]);
const branches = ref<Branch[]>([]);
const error = ref<string | null>(null);
const form = ref({ branchId: 0, businessDate: new Date().toISOString().slice(0, 10) });

async function load(): Promise<void> {
  reports.value = await fetchZReports();
}

async function generate(): Promise<void> {
  error.value = null;
  try {
    await generateZReport(form.value.branchId, form.value.businessDate);
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ออกรายงานไม่สำเร็จ";
  }
}

onMounted(async () => {
  try {
    await load();
    if (canGenerate) {
      branches.value = await fetchBranches();
      if (branches.value[0]) form.value.branchId = branches.value[0].id;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
});
</script>

<template>
  <section>
    <h2>{{ t("zReport") }}</h2>

    <form v-if="canGenerate" @submit.prevent="generate">
      <select v-model.number="form.branchId">
        <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <input v-model="form.businessDate" type="date" />
      <button type="submit">{{ t("generate") }}</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>

    <table>
      <thead>
        <tr>
          <th>{{ t("businessDate") }}</th>
          <th>{{ t("branches") }}</th>
          <th>{{ t("sales") }}</th>
          <th>{{ t("total") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="z in reports" :key="z.id">
          <td>
            <RouterLink :to="`/z-reports/${z.id}`">{{ z.businessDate.slice(0, 10) }}</RouterLink>
          </td>
          <td>{{ z.branch?.name }}</td>
          <td>{{ z.salesCount }}</td>
          <td>{{ z.grossTotal.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
