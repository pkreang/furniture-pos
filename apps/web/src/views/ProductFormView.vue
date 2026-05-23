<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchProducts, createProduct, updateProduct } from "../api/products";
import { fetchCategories, type Category } from "../api/categories";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));
const categories = ref<Category[]>([]);
const error = ref<string | null>(null);

const form = ref({
  sku: "",
  name: "",
  categoryId: 0,
  basePrice: 0,
  isSofa: false,
});

onMounted(async () => {
  categories.value = await fetchCategories();
  if (categories.value[0]) form.value.categoryId = categories.value[0].id;
  if (editingId.value !== null) {
    const existing = (await fetchProducts()).find((p) => p.id === editingId.value);
    if (existing) {
      form.value = {
        sku: existing.sku,
        name: existing.name,
        categoryId: existing.categoryId,
        basePrice: existing.basePrice,
        isSofa: existing.isSofa,
      };
    }
  }
});

async function submit(): Promise<void> {
  error.value = null;
  try {
    if (editingId.value !== null) {
      await updateProduct(editingId.value, {
        name: form.value.name,
        categoryId: form.value.categoryId,
        basePrice: form.value.basePrice,
        isSofa: form.value.isSofa,
      });
    } else {
      await createProduct(form.value);
    }
    router.replace("/products");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("products") }}</h1>
    <div class="card max-w-2xl">
      <form @submit.prevent="submit">
        <div class="form-row">
          <label>{{ t("sku") }}</label>
          <input v-model="form.sku" :disabled="editingId !== null" class="input disabled:bg-slate-100 dark:bg-slate-800" />
        </div>
        <div class="form-row">
          <label>{{ t("products") }}</label>
          <input v-model="form.name" class="input" />
        </div>
        <div class="form-row">
          <label>{{ t("category") }}</label>
          <select v-model.number="form.categoryId" class="input">
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>{{ t("price") }}</label>
          <input v-model.number="form.basePrice" type="number" min="0" class="input" />
        </div>
        <div class="form-row">
          <label class="flex items-center gap-2 font-normal">
            <input v-model="form.isSofa" type="checkbox" /> โซฟา
          </label>
        </div>
        <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary">{{ t("save") }}</button>
          <RouterLink to="/products" class="btn-secondary">{{ t("cancel") }}</RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
