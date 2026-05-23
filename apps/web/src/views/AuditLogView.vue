<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchAuditLog, type AuditEntry } from "../api/admin";

const { t } = useI18n();
const entries = ref<AuditEntry[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    entries.value = await fetchAuditLog();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900">{{ t("auditLog") }}</h1>
    <p v-if="loading" class="text-slate-500">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t("today") }}</th>
            <th>{{ t("users") }}</th>
            <th>{{ t("status") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in entries" :key="e.id">
            <td>{{ new Date(e.createdAt).toLocaleString() }}</td>
            <td>{{ e.user?.username ?? "—" }}</td>
            <td>{{ e.method }} {{ e.path }} → {{ e.statusCode }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
