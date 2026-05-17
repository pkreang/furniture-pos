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
  <section>
    <header>
      <h2>{{ t("products") }}</h2>
      <RouterLink v-if="auth.hasPermission('catalog.manage')" to="/products/new">
        + {{ t("products") }}
      </RouterLink>
    </header>
    <p v-if="loading">…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <table v-else>
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
          <td>{{ p.sku }}</td>
          <td>{{ p.name }}<span v-if="p.isSofa"> 🛋</span></td>
          <td>{{ p.category?.name }}</td>
          <td>{{ p.basePrice.toLocaleString() }}</td>
          <td>
            <RouterLink v-if="auth.hasPermission('catalog.manage')" :to="`/products/${p.id}/edit`">
              {{ t("save") }}
            </RouterLink>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
