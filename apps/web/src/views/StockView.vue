<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchStock, adjustStock, type StockLevel } from "../api/stock";
import { fetchProducts, type Product } from "../api/products";
import { fetchBranches, type Branch } from "../api/branches";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();

const levels = ref<StockLevel[]>([]);
const products = ref<Product[]>([]);
const branches = ref<Branch[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

const canAdjust = auth.hasPermission("stock.adjust");
const form = ref({ productId: 0, branchId: 0, delta: 0, note: "" });

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    levels.value = await fetchStock();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
}

async function submitAdjust(): Promise<void> {
  error.value = null;
  try {
    await adjustStock({
      productId: form.value.productId,
      branchId: form.value.branchId,
      delta: form.value.delta,
      note: form.value.note || undefined,
    });
    form.value.delta = 0;
    form.value.note = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ปรับสต็อกไม่สำเร็จ";
  }
}

onMounted(async () => {
  await load();
  if (canAdjust) {
    products.value = await fetchProducts();
    branches.value = await fetchBranches();
    if (products.value[0]) form.value.productId = products.value[0].id;
    if (branches.value[0]) form.value.branchId = branches.value[0].id;
  }
});
</script>

<template>
  <section>
    <h2>{{ t("stock") }}</h2>

    <form v-if="canAdjust" @submit.prevent="submitAdjust">
      <h3>{{ t("adjust") }}</h3>
      <label>{{ t("products") }}
        <select v-model.number="form.productId">
          <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} — {{ p.name }}</option>
        </select>
      </label>
      <label>{{ t("branches") }}
        <select v-model.number="form.branchId">
          <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </label>
      <label>{{ t("quantity") }} (+/-)
        <input v-model.number="form.delta" type="number" />
      </label>
      <label>หมายเหตุ<input v-model="form.note" /></label>
      <button type="submit">{{ t("save") }}</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading">…</p>
    <table v-else>
      <thead>
        <tr>
          <th>{{ t("sku") }}</th>
          <th>{{ t("products") }}</th>
          <th>{{ t("branches") }}</th>
          <th>{{ t("quantity") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="l in levels" :key="`${l.productId}-${l.branchId}`">
          <td>{{ l.product.sku }}</td>
          <td>{{ l.product.name }}</td>
          <td>{{ l.branch.name }}</td>
          <td>{{ l.quantity }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
