<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchQuotations, type Quotation } from "../api/quotations";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();
const quotations = ref<Quotation[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    quotations.value = await fetchQuotations();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section>
    <header>
      <h2>{{ t("quotations") }}</h2>
      <RouterLink v-if="auth.hasPermission('quotations.manage')" to="/quotations/new">
        + {{ t("quotation") }}
      </RouterLink>
    </header>
    <p v-if="loading">…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <table v-else>
      <thead>
        <tr>
          <th>{{ t("quotation") }}</th>
          <th>{{ t("customer") }}</th>
          <th>{{ t("subtotal") }}</th>
          <th>{{ t("status") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="q in quotations" :key="q.id">
          <td><RouterLink :to="`/quotations/${q.id}`">{{ q.number }}</RouterLink></td>
          <td>{{ q.customer?.name ?? "—" }}</td>
          <td>{{ q.subtotal.toLocaleString() }}</td>
          <td>{{ q.status }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
