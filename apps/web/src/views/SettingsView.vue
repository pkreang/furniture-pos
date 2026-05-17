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
  <section>
    <h2>{{ t("settings") }}</h2>
    <form @submit.prevent="save">
      <label v-for="k in keys" :key="k">
        {{ k }}
        <input v-model="settings[k]" />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="saved">{{ t("save") }} ✓</p>
      <button type="submit">{{ t("save") }}</button>
    </form>
  </section>
</template>
