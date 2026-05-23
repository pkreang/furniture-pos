<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchProducts, type Product } from "../api/products";
import { fetchBranches, type Branch } from "../api/branches";
import { fetchCustomers, type Customer } from "../api/customers";
import { checkout, type PaymentMethod } from "../api/sales";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const products = ref<Product[]>([]);
const branches = ref<Branch[]>([]);
const error = ref<string | null>(null);
const busy = ref(false);

const branchId = ref(0);
const cart = ref<{ productId: number; quantity: number }[]>([]);
const pickProductId = ref(0);
const discountPercent = ref(0);
const paymentMethod = ref<PaymentMethod>("CASH");

const customerQuery = ref("");
const customer = ref<Customer | null>(null);
const redeemPoints = ref(0);

const productById = computed(() => new Map(products.value.map((p) => [p.id, p])));

const cartLines = computed(() =>
  cart.value.map((c) => {
    const p = productById.value.get(c.productId);
    const unitPrice = p?.basePrice ?? 0;
    return {
      productId: c.productId,
      name: p?.name ?? `#${c.productId}`,
      unitPrice,
      quantity: c.quantity,
      lineTotal: unitPrice * c.quantity,
    };
  }),
);

const subtotal = computed(() => cartLines.value.reduce((s, l) => s + l.lineTotal, 0));
const discountAmount = computed(() => Math.round((subtotal.value * discountPercent.value) / 100));
const redeem = computed(() =>
  Math.max(0, Math.min(redeemPoints.value, customer.value?.pointsBalance ?? 0)),
);
const total = computed(() => Math.max(0, subtotal.value - discountAmount.value - redeem.value));

function addToCart(): void {
  if (!pickProductId.value) return;
  const existing = cart.value.find((c) => c.productId === pickProductId.value);
  if (existing) existing.quantity += 1;
  else cart.value.push({ productId: pickProductId.value, quantity: 1 });
}

function removeLine(productId: number): void {
  cart.value = cart.value.filter((c) => c.productId !== productId);
}

async function findCustomer(): Promise<void> {
  error.value = null;
  const matches = await fetchCustomers(customerQuery.value.trim());
  customer.value = matches[0] ?? null;
  if (!customer.value) error.value = "ไม่พบลูกค้า";
}

function clearCustomer(): void {
  customer.value = null;
  redeemPoints.value = 0;
}

async function submit(): Promise<void> {
  error.value = null;
  if (cart.value.length === 0) {
    error.value = "ไม่มีสินค้าในตะกร้า";
    return;
  }
  busy.value = true;
  try {
    const sale = await checkout({
      branchId: branchId.value,
      customerId: customer.value?.id,
      items: cart.value.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      payments: [{ method: paymentMethod.value, amount: total.value }],
      discountPercent: discountPercent.value || undefined,
      redeemPoints: redeem.value || undefined,
    });
    router.push(`/sales/${sale.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ขายไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  products.value = await fetchProducts();
  branches.value = (await fetchBranches()).filter((b) => !b.isWarehouse);
  const own = auth.user?.branchId;
  branchId.value = own ?? branches.value[0]?.id ?? 0;
  if (products.value[0]) pickProductId.value = products.value[0].id;
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("pos") }}</h1>

    <div class="card mb-4">
      <div class="form-row mb-0 max-w-xs">
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
        <button type="button" class="btn-primary" @click="addToCart">{{ t("add") }}</button>
      </div>
    </div>

    <h2 class="text-lg font-semibold mt-6 mb-3 text-slate-800 dark:text-slate-200">{{ t("cart") }}</h2>
    <div class="card overflow-x-auto mb-4">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t("products") }}</th><th>{{ t("price") }}</th>
            <th>{{ t("quantity") }}</th><th>{{ t("total") }}</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in cartLines" :key="line.productId">
            <td>{{ line.name }}</td>
            <td>{{ line.unitPrice.toLocaleString() }}</td>
            <td>
              <input
                v-model.number="cart.find((c) => c.productId === line.productId)!.quantity"
                type="number"
                min="1"
                class="input w-24"
              />
            </td>
            <td>{{ line.lineTotal.toLocaleString() }}</td>
            <td><button type="button" class="btn-danger px-2 py-1 text-xs" @click="removeLine(line.productId)">✕</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2 class="text-lg font-semibold mt-6 mb-3 text-slate-800 dark:text-slate-200">{{ t("customer") }}</h2>
    <div class="card mb-4">
      <div v-if="!customer" class="flex flex-wrap items-end gap-2">
        <div class="form-row flex-1 mb-0 min-w-[200px]">
          <label>{{ t("phone") }}</label>
          <input v-model="customerQuery" :placeholder="t('phone')" class="input" />
        </div>
        <button type="button" class="btn-secondary" @click="findCustomer">{{ t("search") }}</button>
      </div>
      <div v-else class="flex flex-wrap items-end gap-3">
        <span class="text-slate-800 dark:text-slate-200">{{ customer.name }} — {{ t("points") }}: <span class="font-semibold">{{ customer.pointsBalance }}</span></span>
        <button type="button" class="btn-secondary" @click="clearCustomer">{{ t("cancel") }}</button>
        <div class="form-row mb-0">
          <label>{{ t("redeemPoints") }}</label>
          <input v-model.number="redeemPoints" type="number" min="0" :max="customer.pointsBalance" class="input w-32" />
        </div>
      </div>
    </div>

    <h2 class="text-lg font-semibold mt-6 mb-3 text-slate-800 dark:text-slate-200">{{ t("payment") }}</h2>
    <div class="card mb-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="form-row mb-0">
          <label>{{ t("discount") }} %</label>
          <input v-model.number="discountPercent" type="number" min="0" max="100" class="input" />
        </div>
        <div class="form-row mb-0">
          <label>{{ t("payment") }}</label>
          <select v-model="paymentMethod" class="input">
            <option value="CASH">เงินสด</option>
            <option value="TRANSFER">โอนเงิน</option>
            <option value="CARD">บัตร</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm max-w-md">
        <dt class="text-slate-500 dark:text-slate-400">{{ t("subtotal") }}</dt><dd class="text-right text-slate-900 dark:text-slate-100 font-medium">{{ subtotal.toLocaleString() }}</dd>
        <dt class="text-slate-500 dark:text-slate-400">{{ t("discount") }}</dt><dd class="text-right text-slate-900 dark:text-slate-100 font-medium">{{ discountAmount.toLocaleString() }}</dd>
        <dt class="text-slate-500 dark:text-slate-400">{{ t("redeemPoints") }}</dt><dd class="text-right text-slate-900 dark:text-slate-100 font-medium">{{ redeem.toLocaleString() }}</dd>
        <dt class="text-base font-semibold text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-700">{{ t("total") }}</dt>
        <dd class="text-right text-base font-bold text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-200 dark:border-slate-700">{{ total.toLocaleString() }}</dd>
      </dl>
    </div>

    <p v-if="error" class="text-red-600 mb-3">{{ error }}</p>
    <button type="button" :disabled="busy" class="btn-primary" @click="submit">{{ t("checkout") }}</button>
  </div>
</template>
