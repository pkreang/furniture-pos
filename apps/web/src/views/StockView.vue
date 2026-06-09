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
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("stock") }}</h1>

    <div v-if="canAdjust" class="card mb-4">
      <h2 class="text-lg font-semibold mb-3 text-slate-800 dark:text-slate-200">{{ t("adjust") }}</h2>
      <form @submit.prevent="submitAdjust">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-row">
            <label>{{ t("products") }}</label>
            <select v-model.number="form.productId" class="input">
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} — {{ p.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ t("branches") }}</label>
            <select v-model.number="form.branchId" class="input">
              <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ t("quantity") }} (+/-)</label>
            <input v-model.number="form.delta" type="number" class="input" />
          </div>
          <div class="form-row">
            <label>หมายเหตุ</label>
            <input v-model="form.note" class="input" />
          </div>
        </div>
        <button type="submit" class="btn-primary">{{ t("save") }}</button>
      </form>
    </div>

    <p v-if="error" class="text-red-600 mb-3">{{ error }}</p>
    <p v-if="loading" class="text-slate-500 dark:text-slate-400">…</p>
    <div v-else class="card overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t("sku") }}</th>
            <th>{{ t("products") }}</th>
            <th>{{ t("branches") }}</th>
            <th class="text-right">{{ t("quantity") }}</th>
            <th class="text-right">{{ t("reserved") }}</th>
            <th class="text-right">{{ t("available") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in levels" :key="`${l.productId}-${l.branchId}`">
            <td class="font-mono text-xs text-slate-600 dark:text-slate-300">{{ l.product.sku }}</td>
            <td>
              {{ l.product.name }}
              <span
                v-if="[l.product.size, l.product.material, l.product.color].some(Boolean)"
                class="block text-xs text-slate-500 dark:text-slate-400"
              >
                {{ [l.product.size, l.product.material, l.product.color].filter(Boolean).join(" · ") }}
              </span>
            </td>
            <td>{{ l.branch.name }}</td>
            <td class="text-right">{{ l.quantity }}</td>
            <td class="text-right">{{ l.reservedQty }}</td>
            <td
              class="text-right"
              :class="l.available <= 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''"
            >
              {{ l.available }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
