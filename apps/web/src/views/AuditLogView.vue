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
  <section>
    <h2>{{ t("auditLog") }}</h2>
    <p v-if="loading">…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <table v-else>
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
  </section>
</template>
