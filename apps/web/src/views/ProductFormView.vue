<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  fetchProducts,
  createProduct,
  updateProduct,
  uploadProductImage,
  fetchSofaMaterials,
  type SofaMaterial,
} from "../api/products";
import { fetchCategories, type Category } from "../api/categories";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));
const categories = ref<Category[]>([]);
const sofaMaterials = ref<SofaMaterial[]>([]);
const allColors = computed(() => {
  const seen = new Set<string>();
  for (const m of sofaMaterials.value) for (const c of m.colors) seen.add(c.name);
  return [...seen].sort();
});
const error = ref<string | null>(null);
const uploading = ref(false);
const uploadError = ref<string | null>(null);

async function onPickFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  uploadError.value = null;
  try {
    form.value.imageUrl = await uploadProductImage(file);
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ";
  } finally {
    uploading.value = false;
    input.value = ""; // allow re-picking same file
  }
}

const form = ref({
  sku: "",
  name: "",
  categoryId: 0,
  basePrice: 0,
  isSofa: false,
  imageUrl: "",
  size: "",
  material: "",
  color: "",
});

onMounted(async () => {
  const [cats, mats] = await Promise.all([fetchCategories(), fetchSofaMaterials()]);
  categories.value = cats;
  sofaMaterials.value = mats;
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
        size: existing.size ?? "",
        material: existing.material ?? "",
        color: existing.color ?? "",
      };
    }
  }
});

async function submit(): Promise<void> {
  error.value = null;
  const trimmedUrl = form.value.imageUrl.trim();
  const attrs = {
    size: form.value.size.trim() || null,
    material: form.value.material.trim() || null,
    color: form.value.color.trim() || null,
  };
  try {
    if (editingId.value !== null) {
      await updateProduct(editingId.value, {
        name: form.value.name,
        categoryId: form.value.categoryId,
        basePrice: form.value.basePrice,
        isSofa: form.value.isSofa,
        imageUrl: trimmedUrl || null,
        ...attrs,
      });
    } else {
      await createProduct({
        sku: form.value.sku,
        name: form.value.name,
        categoryId: form.value.categoryId,
        basePrice: form.value.basePrice,
        isSofa: form.value.isSofa,
        imageUrl: trimmedUrl || null,
        ...attrs,
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
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="form-row">
            <label>{{ t("itemSize") }}</label>
            <input v-model="form.size" class="input" />
          </div>
          <div class="form-row">
            <label>{{ t("itemMaterials") }}</label>
            <input v-model="form.material" class="input" list="material-options" />
            <datalist id="material-options">
              <option v-for="m in sofaMaterials" :key="m.key" :value="m.name" />
            </datalist>
          </div>
          <div class="form-row">
            <label>{{ t("itemColor") }}</label>
            <input v-model="form.color" class="input" list="color-options" />
            <datalist id="color-options">
              <option v-for="c in allColors" :key="c" :value="c" />
            </datalist>
          </div>
        </div>
        <div class="form-row">
          <label>รูปสินค้า</label>
          <div class="flex items-center gap-3">
            <label
              class="btn-secondary cursor-pointer"
              :class="uploading ? 'opacity-60 pointer-events-none' : ''"
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="hidden"
                @change="onPickFile"
                :disabled="uploading"
              />
              {{ uploading ? "กำลังอัปโหลด..." : "เลือกไฟล์" }}
            </label>
            <span class="text-xs text-slate-500 dark:text-slate-400">หรือวาง URL ด้านล่าง</span>
          </div>
          <input
            v-model="form.imageUrl"
            type="url"
            class="input mt-2"
            placeholder="https://..."
            :disabled="uploading"
          />
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            jpeg / png / webp / gif ≤ 5 MB ผ่าน Vercel Blob หรือวาง URL จาก Imgur / Cloudinary / Drive
          </p>
          <p v-if="uploadError" class="text-red-600 text-sm mt-2">{{ uploadError }}</p>
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
