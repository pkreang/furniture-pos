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
  <div class="p-6 max-w-screen-xl mx-auto">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-slate-900">{{ t("customers") }}</h1>
      <RouterLink v-if="auth.hasPermission('customers.manage')" to="/customers/new" class="btn-primary">
        + {{ t("customer") }}
      </RouterLink>
    </header>
    <form class="card mb-4 flex flex-wrap items-end gap-3" @submit.prevent="load">
      <div class="form-row flex-1 mb-0 min-w-[200px]">
        <label>{{ t("search") }}</label>
        <input v-model="query" :placeholder="t('search')" class="input" />
      </div>
      <button type="submit" class="btn-secondary">{{ t("search") }}</button>
    </form>
    <p v-if="loading" class="text-slate-500">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
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
            <td><RouterLink :to="`/customers/${c.id}`" class="text-indigo-600 hover:text-indigo-700 font-medium">{{ c.name }}</RouterLink></td>
            <td>{{ c.phone }}</td>
            <td>{{ c.tier.name }}</td>
            <td>{{ c.pointsBalance }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
