<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchSuppliers, type Supplier } from "../api/suppliers";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();

const suppliers = ref<Supplier[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);
const query = ref("");
const includeInactive = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    suppliers.value = await fetchSuppliers(
      query.value.trim() || undefined,
      includeInactive.value ? undefined : true,
    );
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
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ t("suppliers") }}</h1>
      <RouterLink v-if="auth.hasPermission('suppliers.manage')" to="/suppliers/new" class="btn-primary">
        + {{ t("supplier") }}
      </RouterLink>
    </header>
    <form class="card mb-4 flex flex-wrap items-end gap-3" @submit.prevent="load">
      <div class="form-row flex-1 mb-0 min-w-[200px]">
        <label>{{ t("search") }}</label>
        <input v-model="query" :placeholder="t('search')" class="input" />
      </div>
      <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 mb-2">
        <input v-model="includeInactive" type="checkbox" @change="load" />
        {{ t("inactive") }}
      </label>
      <button type="submit" class="btn-secondary">{{ t("search") }}</button>
    </form>
    <p v-if="loading" class="text-slate-500 dark:text-slate-400">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t("supplier") }}</th>
            <th>{{ t("contactName") }}</th>
            <th>{{ t("phone") }}</th>
            <th>{{ t("email") }}</th>
            <th>{{ t("taxId") }}</th>
            <th>{{ t("status") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in suppliers" :key="s.id">
            <td class="font-medium text-slate-800 dark:text-slate-200">{{ s.name }}</td>
            <td>{{ s.contactName ?? "" }}</td>
            <td>{{ s.phone ?? "" }}</td>
            <td>{{ s.email ?? "" }}</td>
            <td>{{ s.taxId ?? "" }}</td>
            <td>
              <span v-if="s.isActive" class="badge-success">{{ t("active") }}</span>
              <span v-else class="badge-warning">{{ t("inactive") }}</span>
            </td>
            <td class="text-right">
              <RouterLink
                v-if="auth.hasPermission('suppliers.manage')"
                :to="`/suppliers/${s.id}/edit`"
                class="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                {{ t("save") }}
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
