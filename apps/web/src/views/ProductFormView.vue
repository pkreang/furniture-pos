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
  imageUrl: "",
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
        imageUrl: existing.imageUrl ?? "",
      };
    }
  }
});

async function submit(): Promise<void> {
  error.value = null;
  const trimmedUrl = form.value.imageUrl.trim();
  try {
    if (editingId.value !== null) {
      await updateProduct(editingId.value, {
        name: form.value.name,
        categoryId: form.value.categoryId,
        basePrice: form.value.basePrice,
        isSofa: form.value.isSofa,
        imageUrl: trimmedUrl || null,
      });
    } else {
      await createProduct({
        sku: form.value.sku,
        name: form.value.name,
        categoryId: form.value.categoryId,
        basePrice: form.value.basePrice,
        isSofa: form.value.isSofa,
        imageUrl: trimmedUrl || null,
      });
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
        <div class="form-row">
          <label>URL รูปสินค้า</label>
          <input
            v-model="form.imageUrl"
            type="url"
            class="input"
            placeholder="https://..."
          />
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            วาง URL รูปที่อัปโหลดไว้ที่อื่น (เช่น Imgur, Google Drive แชร์ลิงก์, Vercel Blob) หรือเว้นว่างเพื่อใช้ตัวอักษรย่อแทน
          </p>
          <img
            v-if="form.imageUrl.trim()"
            :src="form.imageUrl.trim()"
            alt="preview"
            class="mt-3 w-40 h-32 object-cover rounded border border-slate-200 dark:border-slate-700"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
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
