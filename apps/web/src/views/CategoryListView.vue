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
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("categories") }}</h1>
    <div v-if="auth.hasPermission('catalog.manage')" class="card mb-4">
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="add">
        <div class="form-row flex-1 mb-0 min-w-[200px]">
          <label>{{ t("category") }}</label>
          <input v-model="newName" :placeholder="t('category')" class="input" />
        </div>
        <button type="submit" class="btn-primary">{{ t("add") }}</button>
      </form>
    </div>
    <p v-if="loading" class="text-slate-500 dark:text-slate-400">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card">
      <ul class="divide-y divide-slate-200">
        <li v-for="c in categories" :key="c.id" class="py-3 text-slate-800 dark:text-slate-200">{{ c.name }}</li>
      </ul>
    </div>
  </div>
</template>
