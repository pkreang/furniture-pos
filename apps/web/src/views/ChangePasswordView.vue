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
  <section class="change-password">
    <h2>{{ t("changePassword") }}</h2>
    <form @submit.prevent="submit">
      <label>{{ t("currentPassword") }}<input v-model="currentPassword" type="password" /></label>
      <label>{{ t("newPassword") }}<input v-model="newPassword" type="password" minlength="8" /></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="busy">{{ t("save") }}</button>
    </form>
  </section>
</template>
