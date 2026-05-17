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
  <section>
    <h2>{{ t("products") }}</h2>
    <form @submit.prevent="submit">
      <label>{{ t("sku") }}
        <input v-model="form.sku" :disabled="editingId !== null" />
      </label>
      <label>{{ t("products") }}<input v-model="form.name" /></label>
      <label>{{ t("category") }}
        <select v-model.number="form.categoryId">
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label>{{ t("price") }}
        <input v-model.number="form.basePrice" type="number" min="0" />
      </label>
      <label><input v-model="form.isSofa" type="checkbox" /> โซฟา</label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit">{{ t("save") }}</button>
      <RouterLink to="/products">{{ t("cancel") }}</RouterLink>
    </form>
  </section>
</template>
