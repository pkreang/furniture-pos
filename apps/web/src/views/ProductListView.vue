<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchProducts, type Product } from "../api/products";
import { fetchCategories, type Category } from "../api/categories";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();

const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

const search = ref("");
const selectedCategoryId = ref<number | null>(null);
const viewMode = ref<"grid" | "table">("grid");

onMounted(async () => {
  loading.value = true;
  try {
    const [p, c] = await Promise.all([fetchProducts(), fetchCategories()]);
    products.value = p;
    categories.value = c;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return products.value.filter((p) => {
    if (selectedCategoryId.value !== null && p.categoryId !== selectedCategoryId.value) {
      return false;
    }
    if (!q) return true;
    return p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });
});

const countByCategory = computed(() => {
  const m = new Map<number, number>();
  for (const p of products.value) m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1);
  return m;
});

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "·";
}
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ t("products") }}</h1>
      <RouterLink
        v-if="auth.hasPermission('catalog.manage')"
        to="/products/new"
        class="btn-primary"
      >
        + {{ t("products") }}
      </RouterLink>
    </header>

    <div v-if="loading" class="text-slate-500 dark:text-slate-400">…</div>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>

    <template v-else>
      <div class="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          v-model="search"
          type="search"
          :placeholder="t('searchPlaceholder')"
          class="input flex-1"
        />
        <div
          class="inline-flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden self-start"
        >
          <button
            type="button"
            @click="viewMode = 'grid'"
            :class="[
              'px-3 py-2 text-sm font-medium transition',
              viewMode === 'grid'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
            ]"
          >
            {{ t("gridView") }}
          </button>
          <button
            type="button"
            @click="viewMode = 'table'"
            :class="[
              'px-3 py-2 text-sm font-medium transition border-l border-slate-300 dark:border-slate-600',
              viewMode === 'table'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
            ]"
          >
            {{ t("tableView") }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          @click="selectedCategoryId = null"
          :class="[
            'px-3 py-1.5 rounded-full text-sm font-medium transition',
            selectedCategoryId === null
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
          ]"
        >
          {{ t("allCategories") }}
          <span class="ml-1 text-xs opacity-70">({{ products.length }})</span>
        </button>
        <button
          v-for="c in categories"
          :key="c.id"
          type="button"
          @click="selectedCategoryId = c.id"
          :class="[
            'px-3 py-1.5 rounded-full text-sm font-medium transition',
            selectedCategoryId === c.id
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
          ]"
        >
          {{ c.name }}
          <span class="ml-1 text-xs opacity-70">({{ countByCategory.get(c.id) ?? 0 }})</span>
        </button>
      </div>

      <p v-if="!filtered.length" class="text-sm text-slate-400 mt-6">{{ t("noData") }}</p>

      <div
        v-else-if="viewMode === 'grid'"
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        <RouterLink
          v-for="p in filtered"
          :key="p.id"
          :to="auth.hasPermission('catalog.manage') ? `/products/${p.id}/edit` : ''"
          class="card group hover:shadow-md transition flex flex-col gap-3"
          :class="auth.hasPermission('catalog.manage') ? 'cursor-pointer' : 'cursor-default'"
        >
          <div
            class="aspect-[4/3] rounded-md bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40 flex items-center justify-center overflow-hidden"
          >
            <img
              v-if="p.imageUrl"
              :src="p.imageUrl"
              :alt="p.name"
              loading="lazy"
              class="w-full h-full object-cover"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <span
              v-else
              class="font-serif text-5xl text-amber-700 dark:text-amber-300"
            >
              {{ initial(p.name) }}
            </span>
          </div>
          <div class="flex-1">
            <p class="font-mono text-[10px] text-slate-500 dark:text-slate-400">{{ p.sku }}</p>
            <p class="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {{ p.name }}<span v-if="p.isSofa"> 🛋</span>
            </p>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ p.category?.name }}</p>
            <p
              v-if="[p.size, p.material, p.color].some(Boolean)"
              class="mt-0.5 text-xs text-slate-400 dark:text-slate-500"
            >
              {{ [p.size, p.material, p.color].filter(Boolean).join(" · ") }}
            </p>
          </div>
          <p class="text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
            {{ p.basePrice.toLocaleString() }}
            <span class="text-xs font-normal text-slate-500 dark:text-slate-400">{{ t("bahtUnit") }}</span>
          </p>
        </RouterLink>
      </div>

      <div v-else class="card overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t("sku") }}</th>
              <th>{{ t("products") }}</th>
              <th>{{ t("category") }}</th>
              <th class="text-right">{{ t("price") }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in filtered" :key="p.id">
              <td class="font-mono text-xs text-slate-600 dark:text-slate-300">{{ p.sku }}</td>
              <td>{{ p.name }}<span v-if="p.isSofa"> 🛋</span></td>
              <td>{{ p.category?.name }}</td>
              <td class="text-right tabular-nums">{{ p.basePrice.toLocaleString() }}</td>
              <td>
                <RouterLink
                  v-if="auth.hasPermission('catalog.manage')"
                  :to="`/products/${p.id}/edit`"
                  class="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  {{ t("save") }}
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
