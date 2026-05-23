<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { changePassword } from "../api/auth";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const currentPassword = ref("");
const newPassword = ref("");
const error = ref<string | null>(null);
const busy = ref(false);

async function submit(): Promise<void> {
  error.value = null;
  busy.value = true;
  try {
    await changePassword(currentPassword.value, newPassword.value);
    await auth.loadMe();
    router.replace("/");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("changePassword") }}</h1>
    <div class="card max-w-md">
      <form @submit.prevent="submit">
        <div class="form-row">
          <label>{{ t("currentPassword") }}</label>
          <input v-model="currentPassword" type="password" class="input" />
        </div>
        <div class="form-row">
          <label>{{ t("newPassword") }}</label>
          <input v-model="newPassword" type="password" minlength="8" class="input" />
        </div>
        <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
        <button type="submit" :disabled="busy" class="btn-primary">{{ t("save") }}</button>
      </form>
    </div>
  </div>
</template>
