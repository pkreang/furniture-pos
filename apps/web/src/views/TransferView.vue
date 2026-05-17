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
  <section>
    <h2>{{ t("transfers") }}</h2>

    <form v-if="canTransfer" @submit.prevent="submitTransfer">
      <h3>{{ t("transfer") }}</h3>
      <label>{{ t("products") }}
        <select v-model.number="form.productId">
          <option v-for="p in products" :key="p.id" :value="p.id">{{ p.sku }} — {{ p.name }}</option>
        </select>
      </label>
      <label>จาก
        <select v-model.number="form.fromBranchId">
          <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </label>
      <label>ไป
        <select v-model.number="form.toBranchId">
          <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </label>
      <label>{{ t("quantity") }}
        <input v-model.number="form.quantity" type="number" min="1" />
      </label>
      <label>หมายเหตุ<input v-model="form.note" /></label>
      <button type="submit">{{ t("save") }}</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading">…</p>
    <table v-else>
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
  </section>
</template>
