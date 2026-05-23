<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const username = ref("");
const password = ref("");
const error = ref<string | null>(null);
const busy = ref(false);

async function submit(): Promise<void> {
  error.value = null;
  busy.value = true;
  try {
    await auth.login(username.value, password.value);
    router.replace(auth.user?.mustChangePassword ? "/change-password" : "/");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6">
    <div class="card w-full max-w-sm">
      <h1 class="text-2xl font-bold mb-6 text-slate-900 text-center">{{ t("login") }}</h1>
      <form @submit.prevent="submit">
        <div class="form-row">
          <label>{{ t("username") }}</label>
          <input v-model="username" class="input" autocomplete="username" />
        </div>
        <div class="form-row">
          <label>{{ t("password") }}</label>
          <input v-model="password" type="password" class="input" autocomplete="current-password" />
        </div>
        <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
        <button type="submit" :disabled="busy" class="btn-primary w-full justify-center">{{ t("login") }}</button>
      </form>
    </div>
  </div>
</template>
