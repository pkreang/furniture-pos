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
  <section>
    <h2>{{ t("quotation") }}</h2>
    <label>{{ t("branches") }}
      <select v-model.number="branchId" :disabled="auth.user?.isBranchScoped">
        <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
    </label>
    <div>
      <select v-model.number="pickProductId">
        <option v-for="p in products" :key="p.id" :value="p.id">
          {{ p.name }} ({{ p.basePrice.toLocaleString() }})
        </option>
      </select>
      <button type="button" @click="addLine">{{ t("add") }}</button>
    </div>
    <table>
      <thead>
        <tr><th>{{ t("products") }}</th><th>{{ t("quantity") }}</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="l in lines" :key="l.productId">
          <td>{{ productById.get(l.productId)?.name }}</td>
          <td><input v-model.number="l.quantity" type="number" min="1" /></td>
          <td><button type="button" @click="removeLine(l.productId)">✕</button></td>
        </tr>
      </tbody>
    </table>
    <p>{{ t("subtotal") }}: {{ subtotal.toLocaleString() }}</p>
    <p v-if="error" class="error">{{ error }}</p>
    <button type="button" :disabled="busy" @click="submit">{{ t("save") }}</button>
    <RouterLink to="/quotations">{{ t("cancel") }}</RouterLink>
  </section>
</template>
