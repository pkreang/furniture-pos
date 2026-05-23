<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchSettings, updateSettings } from "../api/admin";

const { t } = useI18n();

const settings = ref<Record<string, string>>({});
const keys = ref<string[]>([]);
const error = ref<string | null>(null);
const saved = ref(false);

async function load(): Promise<void> {
  settings.value = await fetchSettings();
  keys.value = Object.keys(settings.value).sort();
}

async function save(): Promise<void> {
  error.value = null;
  saved.value = false;
  try {
    settings.value = await updateSettings(settings.value);
    saved.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}

onMounted(async () => {
  try {
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("settings") }}</h1>
    <div class="card max-w-3xl">
      <form @submit.prevent="save">
        <div class="form-row" v-for="k in keys" :key="k">
          <label>{{ k }}</label>
          <input v-model="settings[k]" class="input" />
        </div>
        <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
        <p v-if="saved" class="text-emerald-600 text-sm mb-3">{{ t("save") }} ✓</p>
        <button type="submit" class="btn-primary">{{ t("save") }}</button>
      </form>
    </div>
  </div>
</template>
