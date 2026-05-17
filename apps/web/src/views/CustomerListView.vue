<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchCustomers, type Customer } from "../api/customers";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();

const customers = ref<Customer[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);
const query = ref("");

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    customers.value = await fetchCustomers(query.value.trim() || undefined);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section>
    <header>
      <h2>{{ t("customers") }}</h2>
      <RouterLink v-if="auth.hasPermission('customers.manage')" to="/customers/new">
        + {{ t("customer") }}
      </RouterLink>
    </header>
    <form @submit.prevent="load">
      <input v-model="query" :placeholder="t('search')" />
      <button type="submit">{{ t("search") }}</button>
    </form>
    <p v-if="loading">…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <table v-else>
      <thead>
        <tr>
          <th>{{ t("customer") }}</th>
          <th>{{ t("phone") }}</th>
          <th>{{ t("tier") }}</th>
          <th>{{ t("points") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in customers" :key="c.id">
          <td><RouterLink :to="`/customers/${c.id}`">{{ c.name }}</RouterLink></td>
          <td>{{ c.phone }}</td>
          <td>{{ c.tier.name }}</td>
          <td>{{ c.pointsBalance }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
