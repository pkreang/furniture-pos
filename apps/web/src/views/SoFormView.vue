<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  createSalesOrder,
  updateSalesOrder,
  fetchSalesOrder,
  type SalesOrder,
} from "../api/sales-orders";
import { fetchCustomers, type Customer } from "../api/customers";
import { fetchBranches, type Branch } from "../api/branches";
import { fetchProducts, type Product } from "../api/products";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));

const customers = ref<Customer[]>([]);
const branches = ref<Branch[]>([]);
const products = ref<Product[]>([]);
const loaded = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);
const existingCode = ref<string | null>(null);

interface LineRow {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
}

const customerId = ref<number | "">("");
const branchId = ref<number>(0);
const dueDate = ref<string>("");
const deposit = ref<number>(0);
const notes = ref<string>("");
const poRef = ref<string>("");
const orderDiscount = ref<number>(0);
const lines = ref<LineRow[]>([]);

const productById = computed(() => new Map(products.value.map((p) => [p.id, p])));

const linesSum = computed(() =>
  lines.value.reduce(
    (s, l) => s + Math.max(0, (l.unitPrice || 0) * (l.quantity || 0) - (l.discount || 0)),
    0,
  ),
);
const subtotal = computed(() => Math.max(0, linesSum.value - (orderDiscount.value || 0)));
const vatAmount = computed(() => Math.round(subtotal.value * 0.07));
const totalAmount = computed(() => subtotal.value + vatAmount.value);

function addLine(): void {
  const first = products.value[0];
  if (!first) return;
  lines.value.push({ productId: first.id, quantity: 1, unitPrice: first.basePrice, discount: 0 });
}

function removeLine(idx: number): void {
  lines.value.splice(idx, 1);
}

function onProductChange(line: LineRow): void {
  const product = productById.value.get(line.productId);
  if (product && line.unitPrice === 0) line.unitPrice = product.basePrice;
}

function lineTotal(l: LineRow): number {
  return Math.max(0, (l.unitPrice || 0) * (l.quantity || 0) - (l.discount || 0));
}

function visibleBranches(): Branch[] {
  if (auth.user?.isBranchScoped) {
    return branches.value.filter((b) => b.id === auth.user!.branchId);
  }
  return branches.value;
}

async function submit(): Promise<void> {
  error.value = null;
  if (!branchId.value) {
    error.value = t("branches");
    return;
  }
  if (lines.value.length === 0) {
    error.value = "ต้องมีสินค้าอย่างน้อยหนึ่งรายการ";
    return;
  }
  busy.value = true;
  try {
    const payload = {
      customerId:
        typeof customerId.value === "number" && customerId.value > 0 ? customerId.value : null,
      branchId: branchId.value,
      dueDate: dueDate.value || undefined,
      deposit: Number(deposit.value) || 0,
      notes: notes.value || undefined,
      poRef: poRef.value || undefined,
      discount: Number(orderDiscount.value) || 0,
      items: lines.value.map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discount: Number(l.discount) || 0,
      })),
    };
    let so: SalesOrder;
    if (editingId.value !== null) {
      so = await updateSalesOrder(editingId.value, payload);
    } else {
      so = await createSalesOrder(payload);
    }
    router.replace(`/sales-orders/${so.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    [customers.value, branches.value, products.value] = await Promise.all([
      fetchCustomers(),
      fetchBranches(),
      fetchProducts(),
    ]);
    if (editingId.value !== null) {
      const existing = await fetchSalesOrder(editingId.value);
      if (existing.status !== "DRAFT") {
        error.value = t("soStatusDraft");
      }
      existingCode.value = existing.code;
      customerId.value = existing.customerId ?? "";
      branchId.value = existing.branchId;
      dueDate.value = existing.dueDate ? existing.dueDate.substring(0, 10) : "";
      deposit.value = existing.deposit;
      notes.value = existing.notes ?? "";
      poRef.value = existing.poRef ?? "";
      orderDiscount.value = existing.discount;
      lines.value = (existing.items ?? []).map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount,
      }));
    } else {
      branchId.value = auth.user?.branchId ?? branches.value[0]?.id ?? 0;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loaded.value = true;
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
      <span v-if="existingCode">{{ t("salesOrder") }} {{ existingCode }}</span>
      <span v-else>{{ t("salesOrder") }}</span>
    </h1>
    <p v-if="!loaded" class="text-slate-500 dark:text-slate-400">…</p>
    <template v-else>
      <div class="card mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="form-row mb-0">
          <label>{{ t("customer") }}</label>
          <select v-model.number="customerId" class="input">
            <option :value="''">—</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="form-row mb-0">
          <label>{{ t("branches") }}</label>
          <select
            v-model.number="branchId"
            :disabled="auth.user?.isBranchScoped"
            class="input disabled:bg-slate-100 dark:disabled:bg-slate-700"
          >
            <option v-for="b in visibleBranches()" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="form-row mb-0">
          <label>{{ t("dueDate") }}</label>
          <input v-model="dueDate" type="date" class="input" />
        </div>
        <div class="form-row mb-0">
          <label>{{ t("deposit") }}</label>
          <input v-model.number="deposit" type="number" min="0" class="input" />
        </div>
        <div class="form-row mb-0">
          <label>{{ t("poRef") }}</label>
          <input v-model="poRef" type="text" class="input" />
        </div>
        <div class="form-row mb-0 md:col-span-2">
          <label>{{ t("notes") }}</label>
          <textarea v-model="notes" class="input" rows="2"></textarea>
        </div>
      </div>

      <div class="card overflow-x-auto mb-4">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t("products") }}</th>
              <th class="w-28">{{ t("quantity") }}</th>
              <th class="w-32">{{ t("price") }}</th>
              <th class="w-32">{{ t("discount") }}</th>
              <th class="text-right">{{ t("total") }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, idx) in lines" :key="idx">
              <td>
                <select v-model.number="l.productId" class="input" @change="onProductChange(l)">
                  <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </td>
              <td>
                <input v-model.number="l.quantity" type="number" min="1" class="input w-24" />
              </td>
              <td>
                <input v-model.number="l.unitPrice" type="number" min="0" class="input w-32" />
              </td>
              <td>
                <input v-model.number="l.discount" type="number" min="0" class="input w-32" />
              </td>
              <td class="text-right">{{ lineTotal(l).toLocaleString() }}</td>
              <td>
                <button
                  type="button"
                  class="btn-danger px-2 py-1 text-xs"
                  @click="removeLine(idx)"
                >
                  ✕
                </button>
              </td>
            </tr>
            <tr v-if="lines.length === 0">
              <td colspan="6" class="text-center text-slate-500 dark:text-slate-400 py-4">—</td>
            </tr>
          </tbody>
        </table>
        <div class="pt-3">
          <button type="button" class="btn-secondary text-sm" @click="addLine">
            + {{ t("add") }}
          </button>
        </div>
      </div>

      <div class="card mb-4 max-w-sm ml-auto">
        <div class="flex justify-between py-1 text-slate-700 dark:text-slate-300">
          <span>{{ t("subtotal") }}</span>
          <span>{{ linesSum.toLocaleString() }}</span>
        </div>
        <div class="form-row mb-1 flex items-center justify-between gap-2">
          <label class="mb-0 flex-1">{{ t("discount") }}</label>
          <input v-model.number="orderDiscount" type="number" min="0" class="input w-28 text-right" />
        </div>
        <div class="flex justify-between py-1 text-slate-700 dark:text-slate-300">
          <span>{{ t("vatAmount") }}</span>
          <span>{{ vatAmount.toLocaleString() }}</span>
        </div>
        <div class="flex justify-between py-2 border-t border-slate-200 dark:border-slate-700 mt-1 font-semibold text-slate-900 dark:text-slate-100">
          <span>{{ t("total") }}</span>
          <span>{{ totalAmount.toLocaleString() }}</span>
        </div>
      </div>

      <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
      <div class="flex items-center gap-3">
        <button type="button" :disabled="busy" class="btn-primary" @click="submit">
          {{ t("save") }}
        </button>
        <RouterLink to="/sales-orders" class="btn-secondary">{{ t("cancel") }}</RouterLink>
      </div>
    </template>
  </div>
</template>
