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
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900">{{ t("zReport") }}</h1>

    <div v-if="canGenerate" class="card mb-4">
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="generate">
        <div class="form-row mb-0">
          <label>{{ t("branches") }}</label>
          <select v-model.number="form.branchId" class="input">
            <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="form-row mb-0">
          <label>{{ t("businessDate") }}</label>
          <input v-model="form.businessDate" type="date" class="input" />
        </div>
        <button type="submit" class="btn-primary">{{ t("generate") }}</button>
      </form>
    </div>
    <p v-if="error" class="text-red-600 mb-3">{{ error }}</p>

    <div class="card overflow-x-auto">
      <table class="data-table">
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
              <RouterLink :to="`/z-reports/${z.id}`" class="text-indigo-600 hover:text-indigo-700 font-medium">{{ z.businessDate.slice(0, 10) }}</RouterLink>
            </td>
            <td>{{ z.branch?.name }}</td>
            <td>{{ z.salesCount }}</td>
            <td>{{ z.grossTotal.toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
