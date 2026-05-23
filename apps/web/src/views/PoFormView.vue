<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  fetchPurchaseOrder,
  type PurchaseOrder,
} from "../api/purchase-orders";
import { fetchSuppliers, type Supplier } from "../api/suppliers";
import { fetchBranches, type Branch } from "../api/branches";
import { fetchProducts, type Product } from "../api/products";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));

const suppliers = ref<Supplier[]>([]);
const branches = ref<Branch[]>([]);
const products = ref<Product[]>([]);
const loaded = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);
const existingCode = ref<string | null>(null);

interface LineRow {
  productId: number;
  orderedQty: number;
  unitCost: number;
}

const supplierId = ref<number>(0);
const branchId = ref<number>(0);
const expectedDate = ref<string>("");
const notes = ref<string>("");
const lines = ref<LineRow[]>([]);

const productById = computed(() => new Map(products.value.map((p) => [p.id, p])));

const subtotal = computed(() =>
  lines.value.reduce((s, l) => s + (l.unitCost || 0) * (l.orderedQty || 0), 0),
);
const vatAmount = computed(() => Math.round(subtotal.value * 0.07));
const totalAmount = computed(() => subtotal.value + vatAmount.value);

function addLine(): void {
  const first = products.value[0];
  if (!first) return;
  lines.value.push({ productId: first.id, orderedQty: 1, unitCost: first.basePrice });
}

function removeLine(idx: number): void {
  lines.value.splice(idx, 1);
}

function onProductChange(line: LineRow): void {
  const product = productById.value.get(line.productId);
  if (product && line.unitCost === 0) line.unitCost = product.basePrice;
}

function visibleBranches(): Branch[] {
  if (auth.user?.isBranchScoped) {
    return branches.value.filter((b) => b.id === auth.user!.branchId);
  }
  return branches.value;
}

async function submit(): Promise<void> {
  error.value = null;
  if (!supplierId.value) {
    error.value = t("supplier");
    return;
  }
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
      supplierId: supplierId.value,
      branchId: branchId.value,
      expectedDate: expectedDate.value || undefined,
      notes: notes.value || undefined,
      items: lines.value.map((l) => ({
        productId: l.productId,
        orderedQty: Number(l.orderedQty),
        unitCost: Number(l.unitCost),
      })),
    };
    let po: PurchaseOrder;
    if (editingId.value !== null) {
      po = await updatePurchaseOrder(editingId.value, payload);
    } else {
      po = await createPurchaseOrder(payload);
    }
    router.replace(`/purchase-orders/${po.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    [suppliers.value, branches.value, products.value] = await Promise.all([
      fetchSuppliers(undefined, true),
      fetchBranches(),
      fetchProducts(),
    ]);
    if (editingId.value !== null) {
      const existing = await fetchPurchaseOrder(editingId.value);
      if (existing.status !== "DRAFT") {
        error.value = t("statusDraft");
      }
      existingCode.value = existing.code;
      supplierId.value = existing.supplierId;
      branchId.value = existing.branchId;
      expectedDate.value = existing.expectedDate ? existing.expectedDate.substring(0, 10) : "";
      notes.value = existing.notes ?? "";
      lines.value = (existing.items ?? []).map((it) => ({
        productId: it.productId,
        orderedQty: it.orderedQty,
        unitCost: it.unitCost,
      }));
    } else {
      branchId.value = auth.user?.branchId ?? branches.value[0]?.id ?? 0;
      supplierId.value = suppliers.value[0]?.id ?? 0;
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
      <span v-if="existingCode">{{ t("purchaseOrder") }} {{ existingCode }}</span>
      <span v-else>{{ t("purchaseOrder") }}</span>
    </h1>
    <p v-if="!loaded" class="text-slate-500 dark:text-slate-400">…</p>
    <template v-else>
      <div class="card mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="form-row mb-0">
          <label>{{ t("supplier") }}</label>
          <select v-model.number="supplierId" class="input">
            <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
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
          <label>{{ t("expectedDate") }}</label>
          <input v-model="expectedDate" type="date" class="input" />
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
              <th class="w-32">{{ t("orderedQty") }}</th>
              <th class="w-32">{{ t("unitCost") }}</th>
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
                <input v-model.number="l.orderedQty" type="number" min="1" class="input w-24" />
              </td>
              <td>
                <input v-model.number="l.unitCost" type="number" min="0" class="input w-32" />
              </td>
              <td class="text-right">
                {{ ((l.orderedQty || 0) * (l.unitCost || 0)).toLocaleString() }}
              </td>
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
              <td colspan="5" class="text-center text-slate-500 dark:text-slate-400 py-4">—</td>
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
          <span>{{ subtotal.toLocaleString() }}</span>
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
        <RouterLink to="/purchase-orders" class="btn-secondary">{{ t("cancel") }}</RouterLink>
      </div>
    </template>
  </div>
</template>
