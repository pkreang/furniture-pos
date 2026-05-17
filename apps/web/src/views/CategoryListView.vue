<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchCategories, createCategory, type Category } from "../api/categories";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();

const categories = ref<Category[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);
const newName = ref("");

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    categories.value = await fetchCategories();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
}

async function add(): Promise<void> {
  if (!newName.value.trim()) return;
  error.value = null;
  try {
    await createCategory(newName.value.trim());
    newName.value = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}

onMounted(load);
</script>

<template>
  <section>
    <h2>{{ t("categories") }}</h2>
    <form v-if="auth.hasPermission('catalog.manage')" @submit.prevent="add">
      <input v-model="newName" :placeholder="t('category')" />
      <button type="submit">{{ t("add") }}</button>
    </form>
    <p v-if="loading">…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <ul v-else>
      <li v-for="c in categories" :key="c.id">{{ c.name }}</li>
    </ul>
  </section>
</template>
