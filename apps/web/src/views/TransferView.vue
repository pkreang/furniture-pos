<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchTransfers, createTransfer, type Transfer } from "../api/stock";
import { fetchProducts, type Product } from "../api/products";
import { fetchBranches, type Branch } from "../api/branches";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const auth = useAuthStore();

const transfers = ref<Transfer[]>([]);
const products = ref<Product[]>([]);
const branches = ref<Branch[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

const canTransfer = auth.hasPermission("stock.adjust");
const form = ref({ productId: 0, fromBranchId: 0, toBranchId: 0, quantity: 1, note: "" });

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    transfers.value = await fetchTransfers();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
}

async function submitTransfer(): Promise<void> {
  error.value = null;
  try {
    await createTransfer({
      productId: form.value.productId,
      fromBranchId: form.value.fromBranchId,
      toBranchId: form.value.toBranchId,
      quantity: form.value.quantity,
      note: form.value.note || undefined,
    });
    form.value.quantity = 1;
    form.value.note = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "โอนสินค้าไม่สำเร็จ";
  }
}

onMounted(async () => {
  await load();
  if (canTransfer) {
    products.value = await fetchProducts();
    branches.value = await fetchBranches();
    if (products.value[0]) form.value.productId = products.value[0].id;
    if (branches.value[0]) form.value.fromBranchId = branches.value[0].id;
    if (branches.value[1]) form.value.toBranchId = branches.value[1].id;
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("transfers") }}</h1>

    <div v-if="canTransfer" class="card mb-4">
      <h2 class="text-lg font-semibold mb-3 text-slate-800 dark:text-slate-200">{{ t("transfer") }}</h2>
      <form @submit.prevent="submitTransfer">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-row">
            <label>{{ t("products") }}</label>
            <select v-model.number="form.productId" class="input">
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} — {{ p.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>จาก</label>
            <select v-model.number="form.fromBranchId" class="input">
              <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>ไป</label>
            <select v-model.number="form.toBranchId" class="input">
              <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>{{ t("quantity") }}</label>
            <input v-model.number="form.quantity" type="number" min="1" class="input" />
          </div>
          <div class="form-row md:col-span-2">
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
            <th>{{ t("products") }}</th>
            <th>จาก</th>
            <th>ไป</th>
            <th>{{ t("quantity") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tr in transfers" :key="tr.id">
            <td>{{ tr.product.name }}</td>
            <td>{{ tr.fromBranch.name }}</td>
            <td>{{ tr.toBranch.name }}</td>
            <td>{{ tr.quantity }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
