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

type DiscountType = "AMOUNT" | "PERCENT";
interface QLine {
  productId: number;
  quantity: number;
  discount: number;
  discountType: DiscountType;
}

/** Resolves a baht/percent discount to baht, clamped to [0, base]. */
function resolveDisc(type: DiscountType, value: number, base: number): number {
  if (base <= 0 || value <= 0) return 0;
  const raw = type === "PERCENT" ? Math.round((base * value) / 100) : Math.round(value);
  return Math.min(Math.max(raw, 0), base);
}

const branchId = ref(0);
const lines = ref<QLine[]>([]);
const pickProductId = ref(0);
const orderDiscount = ref(0);
const orderDiscountType = ref<DiscountType>("AMOUNT");

const productById = computed(() => new Map(products.value.map((p) => [p.id, p])));
function lineTotal(l: QLine): number {
  const gross = (productById.value.get(l.productId)?.basePrice ?? 0) * l.quantity;
  return Math.max(0, gross - resolveDisc(l.discountType, l.discount || 0, gross));
}
const subtotal = computed(() => lines.value.reduce((s, l) => s + lineTotal(l), 0));
const orderDiscountResolved = computed(() =>
  resolveDisc(orderDiscountType.value, orderDiscount.value || 0, subtotal.value),
);
// Prices are VAT-inclusive: total = lines − order discount, VAT extracted out.
const total = computed(() => Math.max(0, subtotal.value - orderDiscountResolved.value));
const taxBase = computed(() => Math.round(total.value / 1.07));
const vatAmount = computed(() => total.value - taxBase.value);

function addLine(): void {
  if (!pickProductId.value) return;
  const existing = lines.value.find((l) => l.productId === pickProductId.value);
  if (existing) existing.quantity += 1;
  else lines.value.push({ productId: pickProductId.value, quantity: 1, discount: 0, discountType: "AMOUNT" });
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
    const quote = await createQuotation({
      branchId: branchId.value,
      discountType: orderDiscountType.value,
      discountValue: Number(orderDiscount.value) || 0,
      items: lines.value.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        discountType: l.discountType,
        discountValue: Number(l.discount) || 0,
      })),
    });
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
          <tr>
            <th>{{ t("products") }}</th>
            <th>{{ t("quantity") }}</th>
            <th>{{ t("discount") }}</th>
            <th class="text-right">{{ t("total") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lines" :key="l.productId">
            <td>{{ productById.get(l.productId)?.name }}</td>
            <td><input v-model.number="l.quantity" type="number" min="1" class="input w-20" /></td>
            <td>
              <div class="flex items-center gap-1">
                <input v-model.number="l.discount" type="number" min="0" class="input w-20" />
                <select v-model="l.discountType" class="input w-14 px-1">
                  <option value="AMOUNT">฿</option>
                  <option value="PERCENT">%</option>
                </select>
              </div>
            </td>
            <td class="text-right">{{ lineTotal(l).toLocaleString() }}</td>
            <td><button type="button" class="btn-danger px-2 py-1 text-xs" @click="removeLine(l.productId)">✕</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mb-3 max-w-xs">
      <div class="flex justify-between py-1 text-slate-700 dark:text-slate-300">
        <span>{{ t("subtotal") }}</span>
        <span>{{ subtotal.toLocaleString() }}</span>
      </div>
      <div class="form-row mb-1 flex items-center justify-between gap-2">
        <label class="mb-0 flex-1">{{ t("discount") }}</label>
        <input v-model.number="orderDiscount" type="number" min="0" class="input w-20 text-right" />
        <select v-model="orderDiscountType" class="input w-14 px-1">
          <option value="AMOUNT">฿</option>
          <option value="PERCENT">%</option>
        </select>
      </div>
      <div class="flex justify-between py-1 font-semibold text-slate-800 dark:text-slate-200">
        <span>{{ t("total") }}</span>
        <span>{{ total.toLocaleString() }}</span>
      </div>
      <div class="flex justify-between py-1 text-sm text-slate-500 dark:text-slate-400">
        <span>{{ t("vat") }} 7% (ในยอด)</span>
        <span>{{ vatAmount.toLocaleString() }}</span>
      </div>
      <div class="flex justify-between py-1 text-sm text-slate-500 dark:text-slate-400">
        <span>ฐานภาษี</span>
        <span>{{ taxBase.toLocaleString() }}</span>
      </div>
    </div>
    <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
    <div class="flex items-center gap-3">
      <button type="button" :disabled="busy" class="btn-primary" @click="submit">{{ t("save") }}</button>
      <RouterLink to="/quotations" class="btn-secondary">{{ t("cancel") }}</RouterLink>
    </div>
  </div>
</template>
