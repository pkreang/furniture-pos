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
  <section class="login">
    <h2>{{ t("login") }}</h2>
    <form @submit.prevent="submit">
      <label>{{ t("username") }}<input v-model="username" autocomplete="username" /></label>
      <label>{{ t("password") }}<input v-model="password" type="password" autocomplete="current-password" /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="busy">{{ t("login") }}</button>
    </form>
  </section>
</template>
