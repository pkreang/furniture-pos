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
  <section>
    <header>
      <h2>{{ t("users") }}</h2>
      <RouterLink v-if="auth.hasPermission('users.manage')" to="/users/new">+ {{ t("users") }}</RouterLink>
    </header>
    <p v-if="loading">…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <table v-else>
      <thead>
        <tr><th>{{ t("username") }}</th><th>{{ t("users") }}</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.username }}</td>
          <td>{{ u.name }}<span v-if="!u.isActive"> (ปิดใช้งาน)</span></td>
          <td>
            <RouterLink v-if="auth.hasPermission('users.manage')" :to="`/users/${u.id}/edit`">
              {{ t("save") }}
            </RouterLink>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
