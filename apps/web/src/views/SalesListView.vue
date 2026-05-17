<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchSales, type Sale } from "../api/sales";

const { t } = useI18n();
const sales = ref<Sale[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    sales.value = await fetchSales();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section>
    <h2>{{ t("sales") }}</h2>
    <p v-if="loading">…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <table v-else>
      <thead>
        <tr>
          <th>{{ t("receipt") }}</th>
          <th>{{ t("branches") }}</th>
          <th>{{ t("customer") }}</th>
          <th>{{ t("total") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in sales" :key="s.id">
          <td><RouterLink :to="`/sales/${s.id}`">{{ s.number }}</RouterLink></td>
          <td>{{ s.branch?.name }}</td>
          <td>{{ s.customer?.name ?? "—" }}</td>
          <td>{{ s.total.toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
