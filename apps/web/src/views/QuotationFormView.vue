<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchProducts, type Product } from "../api/products";
import { fetchBranches, type Branch } from "../api/branches";
import { createQuotation } from "../api/quotations";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const products = ref<Product[]>([]);
const branches = ref<Branch[]>([]);
const error = ref<string | null>(null);
const busy = ref(false);

const branchId = ref(0);
const lines = ref<{ productId: number; quantity: number }[]>([]);
const pickProductId = ref(0);

const productById = computed(() => new Map(products.value.map((p) => [p.id, p])));
const subtotal = computed(() =>
  lines.value.reduce((s, l) => s + (productById.value.get(l.productId)?.basePrice ?? 0) * l.quantity, 0),
);

function addLine(): void {
  if (!pickProductId.value) return;
  const existing = lines.value.find((l) => l.productId === pickProductId.value);
  if (existing) existing.quantity += 1;
  else lines.value.push({ productId: pickProductId.value, quantity: 1 });
}

function removeLine(productId: number): void {
  lines.value = lines.value.filter((l) => l.productId !== productId);
}

async function submit(): Promise<void> {
  error.value = null;
  if (lines.value.length === 0) {
    error.value = "ต้องมีสินค้าอย่างน้อยหนึ่งรายการ";
    return;
  }
  busy.value = true;
  try {
    const quote = await createQuotation({ branchId: branchId.value, items: lines.value });
    router.push(`/quotations/${quote.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  products.value = await fetchProducts();
  branches.value = await fetchBranches();
  branchId.value = auth.user?.branchId ?? branches.value[0]?.id ?? 0;
  if (products.value[0]) pickProductId.value = products.value[0].id;
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("quotation") }}</h1>
    <div class="card mb-4 max-w-xs">
      <div class="form-row mb-0">
        <label>{{ t("branches") }}</label>
        <select v-model.number="branchId" :disabled="auth.user?.isBranchScoped" class="input disabled:bg-slate-100 dark:bg-slate-800">
          <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>
    </div>
    <div class="card mb-4">
      <div class="flex flex-wrap items-end gap-2">
        <div class="form-row flex-1 mb-0 min-w-[220px]">
          <label>{{ t("products") }}</label>
          <select v-model.number="pickProductId" class="input">
            <option v-for="p in products" :key="p.id" :value="p.id">
              {{ p.name }} ({{ p.basePrice.toLocaleString() }})
            </option>
          </select>
        </div>
        <button type="button" class="btn-primary" @click="addLine">{{ t("add") }}</button>
      </div>
    </div>
    <div class="card overflow-x-auto mb-4">
      <table class="data-table">
        <thead>
          <tr><th>{{ t("products") }}</th><th>{{ t("quantity") }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="l in lines" :key="l.productId">
            <td>{{ productById.get(l.productId)?.name }}</td>
            <td><input v-model.number="l.quantity" type="number" min="1" class="input w-24" /></td>
            <td><button type="button" class="btn-danger px-2 py-1 text-xs" @click="removeLine(l.productId)">✕</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mb-3 text-slate-800 dark:text-slate-200 font-semibold">{{ t("subtotal") }}: {{ subtotal.toLocaleString() }}</p>
    <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
    <div class="flex items-center gap-3">
      <button type="button" :disabled="busy" class="btn-primary" @click="submit">{{ t("save") }}</button>
      <RouterLink to="/quotations" class="btn-secondary">{{ t("cancel") }}</RouterLink>
    </div>
  </div>
</template>
