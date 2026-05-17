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
  <section>
    <h2>{{ t("pos") }}</h2>

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
      <button type="button" @click="addToCart">{{ t("add") }}</button>
    </div>

    <h3>{{ t("cart") }}</h3>
    <table>
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
            />
          </td>
          <td>{{ line.lineTotal.toLocaleString() }}</td>
          <td><button type="button" @click="removeLine(line.productId)">✕</button></td>
        </tr>
      </tbody>
    </table>

    <h3>{{ t("customer") }}</h3>
    <div v-if="!customer">
      <input v-model="customerQuery" :placeholder="t('phone')" />
      <button type="button" @click="findCustomer">{{ t("search") }}</button>
    </div>
    <div v-else>
      <span>{{ customer.name }} — {{ t("points") }}: {{ customer.pointsBalance }}</span>
      <button type="button" @click="clearCustomer">{{ t("cancel") }}</button>
      <label>{{ t("redeemPoints") }}
        <input v-model.number="redeemPoints" type="number" min="0" :max="customer.pointsBalance" />
      </label>
    </div>

    <h3>{{ t("payment") }}</h3>
    <label>{{ t("discount") }} %
      <input v-model.number="discountPercent" type="number" min="0" max="100" />
    </label>
    <label>{{ t("payment") }}
      <select v-model="paymentMethod">
        <option value="CASH">เงินสด</option>
        <option value="TRANSFER">โอนเงิน</option>
        <option value="CARD">บัตร</option>
      </select>
    </label>

    <dl>
      <dt>{{ t("subtotal") }}</dt><dd>{{ subtotal.toLocaleString() }}</dd>
      <dt>{{ t("discount") }}</dt><dd>{{ discountAmount.toLocaleString() }}</dd>
      <dt>{{ t("redeemPoints") }}</dt><dd>{{ redeem.toLocaleString() }}</dd>
      <dt>{{ t("total") }}</dt><dd>{{ total.toLocaleString() }}</dd>
    </dl>

    <p v-if="error" class="error">{{ error }}</p>
    <button type="button" :disabled="busy" @click="submit">{{ t("checkout") }}</button>
  </section>
</template>
