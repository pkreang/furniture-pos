<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchUsers, type User } from "../api/users";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();
const users = ref<User[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    users.value = await fetchUsers();
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
      <h1 class="text-2xl font-bold text-slate-900">{{ t("users") }}</h1>
      <RouterLink v-if="auth.hasPermission('users.manage')" to="/users/new" class="btn-primary">+ {{ t("users") }}</RouterLink>
    </header>
    <p v-if="loading" class="text-slate-500">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr><th>{{ t("username") }}</th><th>{{ t("users") }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td class="font-mono text-xs text-slate-600">{{ u.username }}</td>
            <td>{{ u.name }}<span v-if="!u.isActive" class="text-slate-500"> (ปิดใช้งาน)</span></td>
            <td>
              <RouterLink
                v-if="auth.hasPermission('users.manage')"
                :to="`/users/${u.id}/edit`"
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
