<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchProducts, type Product } from "../api/products";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();

const products = ref<Product[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    products.value = await fetchProducts();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ t("products") }}</h1>
      <RouterLink v-if="auth.hasPermission('catalog.manage')" to="/products/new" class="btn-primary">
        + {{ t("products") }}
      </RouterLink>
    </header>
    <p v-if="loading" class="text-slate-500 dark:text-slate-400">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t("sku") }}</th>
            <th>{{ t("products") }}</th>
            <th>{{ t("category") }}</th>
            <th>{{ t("price") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id">
            <td class="font-mono text-xs text-slate-600 dark:text-slate-300">{{ p.sku }}</td>
            <td>{{ p.name }}<span v-if="p.isSofa"> 🛋</span></td>
            <td>{{ p.category?.name }}</td>
            <td>{{ p.basePrice.toLocaleString() }}</td>
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
  </div>
</template>
