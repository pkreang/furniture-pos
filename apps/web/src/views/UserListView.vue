<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchUsers, resetUserPassword, type User } from "../api/users";
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

async function doReset(user: User): Promise<void> {
  const pw = window.prompt(
    `ตั้งรหัสผ่านชั่วคราวให้ ${user.name} (${user.username}) — ผู้ใช้จะต้องเปลี่ยนรหัสเองเมื่อเข้าระบบครั้งถัดไป`,
  );
  if (!pw) return;
  if (pw.length < 8) {
    window.alert("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    return;
  }
  try {
    await resetUserPassword(user.id, pw);
    window.alert(`ตั้งรหัสผ่านใหม่ให้ ${user.username} เรียบร้อย — ส่งรหัสนี้ให้ผู้ใช้เพื่อ login`);
  } catch (e) {
    window.alert(e instanceof Error ? e.message : "ตั้งรหัสผ่านไม่สำเร็จ");
  }
}

onMounted(load);
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ t("users") }}</h1>
      <RouterLink v-if="auth.hasPermission('users.manage')" to="/users/new" class="btn-primary">+ {{ t("users") }}</RouterLink>
    </header>
    <p v-if="loading" class="text-slate-500 dark:text-slate-400">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr><th>{{ t("username") }}</th><th>{{ t("users") }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td class="font-mono text-xs text-slate-600 dark:text-slate-300">{{ u.username }}</td>
            <td>{{ u.name }}<span v-if="!u.isActive" class="text-slate-500 dark:text-slate-400"> (ปิดใช้งาน)</span></td>
            <td class="space-x-3 whitespace-nowrap">
              <RouterLink
                v-if="auth.hasPermission('users.manage')"
                :to="`/users/${u.id}/edit`"
                class="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                {{ t("save") }}
              </RouterLink>
              <button
                v-if="auth.hasPermission('users.manage') && u.id !== auth.user?.id"
                type="button"
                @click="doReset(u)"
                class="text-amber-600 hover:text-amber-700 text-sm font-medium"
              >
                {{ t("resetPassword") }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
