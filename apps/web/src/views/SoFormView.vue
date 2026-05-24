<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  createSalesOrder,
  updateSalesOrder,
  fetchSalesOrder,
  type SalesOrder,
  type BillingType,
  type SoDeliveryType,
  type PaymentTerm,
  type PaymentMethodKind,
  type CardType,
  type DeliveryInfo,
} from "../api/sales-orders";
import { fetchCustomers, type Customer } from "../api/customers";
import { fetchBranches, type Branch } from "../api/branches";
import { fetchProducts, type Product } from "../api/products";
import { fetchUsers, type User } from "../api/users";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));

const customers = ref<Customer[]>([]);
const branches = ref<Branch[]>([]);
const products = ref<Product[]>([]);
const users = ref<User[]>([]);
const salesStaff = computed(() => users.value.filter((u) => u.isActive));
const loaded = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);
const existingCode = ref<string | null>(null);

interface LineRow {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  size: string;
  materials: string;
  color: string;
  expanded: boolean;
}

const customerId = ref<number | "">("");
const branchId = ref<number>(0);
const salespersonId = ref<number | "">("");
const dueDate = ref<string>("");
const deposit = ref<number>(0);
const notes = ref<string>("");
const poRef = ref<string>("");
const orderDiscount = ref<number>(0);
const lines = ref<LineRow[]>([]);

// Booking-form fields
const bookNo = ref<string>("");
const billingType = ref<BillingType | "">("");
const billingBranchNo = ref<string>("");
const customerPhone2 = ref<string>("");
const addrLine1 = ref<string>("");
const addrMoo = ref<string>("");
const addrSoi = ref<string>("");
const addrStreet = ref<string>("");
const addrKwang = ref<string>("");
const addrDistrict = ref<string>("");
const addrProvince = ref<string>("");
const addrPostal = ref<string>("");

const canShipImmediately = ref<boolean>(false);
const deliveryType = ref<SoDeliveryType | "">("");
const deliveryTypeOther = ref<string>("");

const survey = ref<DeliveryInfo>({});

const paymentTerm = ref<PaymentTerm | "">("");
const installmentMonths = ref<number | "">("");
const depositMethod = ref<PaymentMethodKind | "">("");
const depositCardType = ref<CardType | "">("");
const balanceMethod = ref<PaymentMethodKind | "">("");
const balanceCardType = ref<CardType | "">("");

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
  lines.value.push({
    productId: first.id,
    quantity: 1,
    unitPrice: first.basePrice,
    discount: 0,
    size: "",
    materials: "",
    color: "",
    expanded: false,
  });
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

// Prefill phone2/address overrides when the user picks a customer (only fill
// empty fields — never overwrite values the cashier already typed). Falls back
// to legacy free-text taxAddress for customers that pre-date structured fields.
watch(customerId, (id) => {
  if (typeof id !== "number" || id <= 0) return;
  const c = customers.value.find((cc) => cc.id === id);
  if (!c) return;
  if (!customerPhone2.value && c.phone2) customerPhone2.value = c.phone2;
  if (!billingType.value && c.billingType) billingType.value = c.billingType;
  if (!billingBranchNo.value && c.billingBranchNo) billingBranchNo.value = c.billingBranchNo;
  if (!addrLine1.value) addrLine1.value = c.addrLine1 || c.taxAddress || "";
  if (!addrMoo.value && c.addrMoo) addrMoo.value = c.addrMoo;
  if (!addrSoi.value && c.addrSoi) addrSoi.value = c.addrSoi;
  if (!addrStreet.value && c.addrStreet) addrStreet.value = c.addrStreet;
  if (!addrKwang.value && c.addrKwang) addrKwang.value = c.addrKwang;
  if (!addrDistrict.value && c.addrDistrict) addrDistrict.value = c.addrDistrict;
  if (!addrProvince.value && c.addrProvince) addrProvince.value = c.addrProvince;
  if (!addrPostal.value && c.addrPostal) addrPostal.value = c.addrPostal;
});

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
      salespersonId:
        typeof salespersonId.value === "number" && salespersonId.value > 0
          ? salespersonId.value
          : undefined,
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
        size: l.size || null,
        materials: l.materials || null,
        color: l.color || null,
      })),
      bookNo: bookNo.value || null,
      billingType: billingType.value || null,
      billingBranchNo: billingBranchNo.value || null,
      customerPhone2: customerPhone2.value || null,
      addrLine1: addrLine1.value || null,
      addrMoo: addrMoo.value || null,
      addrSoi: addrSoi.value || null,
      addrStreet: addrStreet.value || null,
      addrKwang: addrKwang.value || null,
      addrDistrict: addrDistrict.value || null,
      addrProvince: addrProvince.value || null,
      addrPostal: addrPostal.value || null,
      canShipImmediately: canShipImmediately.value,
      deliveryType: deliveryType.value || null,
      deliveryTypeOther: deliveryTypeOther.value || null,
      deliveryInfo: survey.value,
      paymentTerm: paymentTerm.value || null,
      installmentMonths:
        typeof installmentMonths.value === "number" ? installmentMonths.value : null,
      depositMethod: depositMethod.value || null,
      depositCardType: depositCardType.value || null,
      balanceMethod: balanceMethod.value || null,
      balanceCardType: balanceCardType.value || null,
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

const surveyOpen = ref(true);

onMounted(async () => {
  try {
    [customers.value, branches.value, products.value, users.value] = await Promise.all([
      fetchCustomers(),
      fetchBranches(),
      fetchProducts(),
      fetchUsers().catch(() => [] as User[]),
    ]);
    if (editingId.value !== null) {
      const existing = await fetchSalesOrder(editingId.value);
      if (existing.status !== "DRAFT") {
        error.value = t("soStatusDraft");
      }
      existingCode.value = existing.code;
      customerId.value = existing.customerId ?? "";
      branchId.value = existing.branchId;
      salespersonId.value = existing.salespersonId ?? existing.createdBy?.id ?? "";
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
        size: it.size ?? "",
        materials: it.materials ?? "",
        color: it.color ?? "",
        expanded: Boolean(it.size || it.materials || it.color),
      }));
      bookNo.value = existing.bookNo ?? "";
      billingType.value = existing.billingType ?? "";
      billingBranchNo.value = existing.billingBranchNo ?? "";
      customerPhone2.value = existing.customerPhone2 ?? "";
      addrLine1.value = existing.addrLine1 ?? "";
      addrMoo.value = existing.addrMoo ?? "";
      addrSoi.value = existing.addrSoi ?? "";
      addrStreet.value = existing.addrStreet ?? "";
      addrKwang.value = existing.addrKwang ?? "";
      addrDistrict.value = existing.addrDistrict ?? "";
      addrProvince.value = existing.addrProvince ?? "";
      addrPostal.value = existing.addrPostal ?? "";
      canShipImmediately.value = existing.canShipImmediately;
      deliveryType.value = existing.deliveryType ?? "";
      deliveryTypeOther.value = existing.deliveryTypeOther ?? "";
      survey.value = existing.deliveryInfo ?? {};
      paymentTerm.value = existing.paymentTerm ?? "";
      installmentMonths.value = existing.installmentMonths ?? "";
      depositMethod.value = existing.depositMethod ?? "";
      depositCardType.value = existing.depositCardType ?? "";
      balanceMethod.value = existing.balanceMethod ?? "";
      balanceCardType.value = existing.balanceCardType ?? "";
      surveyOpen.value = false;
    } else {
      branchId.value = auth.user?.branchId ?? branches.value[0]?.id ?? 0;
      salespersonId.value = auth.user?.id ?? "";
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
      <!-- 1. Booking info -->
      <section class="card mb-4">
        <h2 class="font-semibold mb-3 text-slate-800 dark:text-slate-200">
          {{ t("bookingInfo") }}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-row mb-0">
            <label>{{ t("bookNo") }}</label>
            <input v-model="bookNo" type="text" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("poRef") }}</label>
            <input v-model="poRef" type="text" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("salesperson") }}</label>
            <select v-model.number="salespersonId" class="input">
              <option value="">—</option>
              <option v-for="u in salesStaff" :key="u.id" :value="u.id">{{ u.name }}</option>
            </select>
          </div>
          <div class="form-row mb-0 md:col-span-2">
            <label>{{ t("notes") }}</label>
            <textarea v-model="notes" class="input" rows="2"></textarea>
          </div>
        </div>
      </section>

      <!-- 2. Customer -->
      <section class="card mb-4">
        <h2 class="font-semibold mb-3 text-slate-800 dark:text-slate-200">
          {{ t("customerInfo") }}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <label>{{ t("phone2") }}</label>
            <input v-model="customerPhone2" type="text" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("billingType") }}</label>
            <div>
              <label class="inline-flex items-center gap-1 mr-3">
                <input v-model="billingType" type="radio" value="HEAD_OFFICE" />
                {{ t("headOffice") }}
              </label>
              <label class="inline-flex items-center gap-1 mr-3">
                <input v-model="billingType" type="radio" value="BRANCH" />
                {{ t("branchOffice") }}
              </label>
              <input
                v-if="billingType === 'BRANCH'"
                v-model="billingBranchNo"
                type="text"
                class="input inline-block w-32 ml-2"
                :placeholder="t('branchNo')"
              />
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <div class="form-row mb-0 md:col-span-2">
            <label>{{ t("addrLine1") }}</label>
            <input v-model="addrLine1" type="text" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("addrMoo") }}</label>
            <input v-model="addrMoo" type="text" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("addrSoi") }}</label>
            <input v-model="addrSoi" type="text" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("addrStreet") }}</label>
            <input v-model="addrStreet" type="text" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("addrKwang") }}</label>
            <input v-model="addrKwang" type="text" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("addrDistrict") }}</label>
            <input v-model="addrDistrict" type="text" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("addrProvince") }}</label>
            <input v-model="addrProvince" type="text" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("addrPostal") }}</label>
            <input v-model="addrPostal" type="text" class="input" />
          </div>
        </div>
      </section>

      <!-- 3. Items -->
      <section class="card overflow-x-auto mb-4">
        <h2 class="font-semibold mb-3 text-slate-800 dark:text-slate-200">
          {{ t("products") }}
        </h2>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t("products") }}</th>
              <th class="w-24">{{ t("quantity") }}</th>
              <th class="w-28">{{ t("price") }}</th>
              <th class="w-24">{{ t("discount") }}</th>
              <th class="text-right">{{ t("total") }}</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(l, idx) in lines" :key="idx">
              <tr>
                <td>
                  <select v-model.number="l.productId" class="input" @change="onProductChange(l)">
                    <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
                  </select>
                </td>
                <td>
                  <input v-model.number="l.quantity" type="number" min="1" class="input w-20" />
                </td>
                <td>
                  <input v-model.number="l.unitPrice" type="number" min="0" class="input w-28" />
                </td>
                <td>
                  <input v-model.number="l.discount" type="number" min="0" class="input w-24" />
                </td>
                <td class="text-right">{{ lineTotal(l).toLocaleString() }}</td>
                <td class="space-x-1 whitespace-nowrap">
                  <button
                    type="button"
                    class="btn-secondary px-2 py-1 text-xs"
                    :title="t('itemSize')"
                    @click="l.expanded = !l.expanded"
                  >
                    {{ l.expanded ? "−" : "+" }}
                  </button>
                  <button
                    type="button"
                    class="btn-danger px-2 py-1 text-xs"
                    @click="removeLine(idx)"
                  >
                    ✕
                  </button>
                </td>
              </tr>
              <tr v-if="l.expanded">
                <td colspan="6">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 p-2">
                    <div class="form-row mb-0">
                      <label>{{ t("itemSize") }}</label>
                      <input v-model="l.size" type="text" class="input" />
                    </div>
                    <div class="form-row mb-0">
                      <label>{{ t("itemMaterials") }}</label>
                      <input v-model="l.materials" type="text" class="input" />
                    </div>
                    <div class="form-row mb-0">
                      <label>{{ t("itemColor") }}</label>
                      <input v-model="l.color" type="text" class="input" />
                    </div>
                  </div>
                </td>
              </tr>
            </template>
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
      </section>

      <!-- Totals box -->
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

      <!-- 4. Delivery -->
      <section class="card mb-4">
        <h2 class="font-semibold mb-3 text-slate-800 dark:text-slate-200">
          {{ t("deliverySection") }}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-row mb-0">
            <label>{{ t("dueDate") }}</label>
            <input v-model="dueDate" type="date" class="input" />
          </div>
          <div class="form-row mb-0">
            <label class="inline-flex items-center gap-2">
              <input v-model="canShipImmediately" type="checkbox" />
              {{ t("canShipImmediately") }}
            </label>
          </div>
          <div class="form-row mb-0 md:col-span-2">
            <label>{{ t("deliveryType") }}</label>
            <div>
              <label class="inline-flex items-center gap-1 mr-3">
                <input v-model="deliveryType" type="radio" value="COMPANY" />
                {{ t("deliveryTypeCompany") }}
              </label>
              <label class="inline-flex items-center gap-1 mr-3">
                <input v-model="deliveryType" type="radio" value="SELF_PICKUP" />
                {{ t("deliveryTypeSelf") }}
              </label>
              <label class="inline-flex items-center gap-1 mr-3">
                <input v-model="deliveryType" type="radio" value="OTHER" />
                {{ t("deliveryTypeOther") }}
              </label>
              <input
                v-if="deliveryType === 'OTHER'"
                v-model="deliveryTypeOther"
                type="text"
                class="input inline-block w-48 ml-2"
              />
            </div>
          </div>
        </div>

        <details :open="surveyOpen" class="mt-3">
          <summary class="cursor-pointer font-semibold text-slate-700 dark:text-slate-300 py-2">
            {{ t("deliverySurvey") }}
          </summary>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div class="form-row mb-0">
              <label class="font-semibold">1. {{ t("survey1") }}</label>
              <input v-model="survey.floor" type="text" class="input" />
            </div>
            <div class="form-row mb-0">
              <label class="font-semibold">2. {{ t("survey2") }}</label>
              <input v-model="survey.roomDoor" type="text" class="input" />
            </div>
            <div class="form-row mb-0">
              <label class="font-semibold">3. {{ t("survey3") }}</label>
              <input v-model="survey.preRoomDoor" type="text" class="input" />
            </div>
            <div class="form-row mb-0">
              <label class="font-semibold">4. {{ t("survey4") }}</label>
              <div>
                <label class="inline-flex items-center gap-1 mr-3">
                  <input v-model="survey.hasLift" type="radio" :value="true" />
                  {{ t("yes") }}
                </label>
                <label class="inline-flex items-center gap-1 mr-3">
                  <input v-model="survey.hasLift" type="radio" :value="false" />
                  {{ t("no") }}
                </label>
              </div>
            </div>
            <div class="form-row mb-0">
              <label class="font-semibold">5. {{ t("survey5") }}</label>
              <input v-model="survey.liftDoor" type="text" class="input" />
            </div>
            <div class="form-row mb-0">
              <label class="font-semibold">6. {{ t("survey6") }}</label>
              <input v-model="survey.liftInterior" type="text" class="input" />
            </div>
            <div class="form-row mb-0">
              <label class="font-semibold">7. {{ t("survey7") }}</label>
              <div class="flex gap-2 items-center">
                <label class="inline-flex items-center gap-1">
                  <input v-model="survey.hasDoorBeforeLift" type="radio" :value="true" />
                  {{ t("yes") }}
                </label>
                <label class="inline-flex items-center gap-1">
                  <input v-model="survey.hasDoorBeforeLift" type="radio" :value="false" />
                  {{ t("no") }}
                </label>
                <input
                  v-if="survey.hasDoorBeforeLift"
                  v-model="survey.doorBeforeLiftSize"
                  type="text"
                  class="input flex-1"
                  :placeholder="t('sizeLabel')"
                />
              </div>
            </div>
            <div class="form-row mb-0">
              <label class="font-semibold">8. {{ t("survey8") }}</label>
              <input v-model="survey.stair" type="text" class="input" />
            </div>
            <div class="form-row mb-0">
              <label class="font-semibold">9. {{ t("survey9") }}</label>
              <div class="flex gap-2 items-center">
                <label class="inline-flex items-center gap-1">
                  <input v-model="survey.stairTurns" type="radio" :value="true" />
                  {{ t("yes") }}
                </label>
                <label class="inline-flex items-center gap-1">
                  <input v-model="survey.stairTurns" type="radio" :value="false" />
                  {{ t("no") }}
                </label>
                <input
                  v-if="survey.stairTurns"
                  v-model="survey.stairTurnsSize"
                  type="text"
                  class="input flex-1"
                  :placeholder="t('sizeLabel')"
                />
              </div>
            </div>
            <div class="form-row mb-0">
              <label class="font-semibold">10. {{ t("survey10") }}</label>
              <div class="grid grid-cols-2 gap-2">
                <input
                  v-model="survey.ceilingHeight"
                  type="text"
                  class="input"
                  :placeholder="t('ceilingHeight')"
                />
                <input
                  v-model="survey.ceilingObstacles"
                  type="text"
                  class="input"
                  :placeholder="t('ceilingObstacles')"
                />
              </div>
            </div>
          </div>
        </details>
      </section>

      <!-- 5. Payment -->
      <section class="card mb-4">
        <h2 class="font-semibold mb-3 text-slate-800 dark:text-slate-200">
          {{ t("paymentSection") }}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-row mb-0">
            <label>{{ t("deposit") }}</label>
            <input v-model.number="deposit" type="number" min="0" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("paymentTerm") }}</label>
            <div>
              <label class="inline-flex items-center gap-1 mr-3">
                <input v-model="paymentTerm" type="radio" value="DEPOSIT" />
                {{ t("paymentTermDeposit") }}
              </label>
              <label class="inline-flex items-center gap-1 mr-3">
                <input v-model="paymentTerm" type="radio" value="FULL" />
                {{ t("paymentTermFull") }}
              </label>
              <label class="inline-flex items-center gap-1 mr-3">
                <input v-model="paymentTerm" type="radio" value="INSTALLMENT" />
                {{ t("paymentTermInstallment") }}
              </label>
              <input
                v-if="paymentTerm === 'INSTALLMENT'"
                v-model.number="installmentMonths"
                type="number"
                min="0"
                class="input inline-block w-24 ml-2"
                :placeholder="t('installmentMonths')"
              />
            </div>
          </div>
        </div>

        <div class="mt-4">
          <h3 class="font-semibold mb-2 text-slate-700 dark:text-slate-300">
            {{ t("depositMethodSection") }}
          </h3>
          <div>
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="depositMethod" type="radio" value="CASH" />
              {{ t("methodCash") }}
            </label>
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="depositMethod" type="radio" value="TRANSFER" />
              {{ t("methodTransfer") }}
            </label>
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="depositMethod" type="radio" value="CREDIT_CARD" />
              {{ t("methodCard") }}
            </label>
          </div>
          <div v-if="depositMethod === 'CREDIT_CARD'" class="mt-2">
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="depositCardType" type="radio" value="VISA" />
              {{ t("cardVisa") }}
            </label>
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="depositCardType" type="radio" value="MASTERCARD" />
              {{ t("cardMaster") }}
            </label>
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="depositCardType" type="radio" value="OTHER" />
              {{ t("cardOther") }}
            </label>
          </div>
        </div>

        <div class="mt-4">
          <h3 class="font-semibold mb-2 text-slate-700 dark:text-slate-300">
            {{ t("balanceMethodSection") }}
          </h3>
          <div>
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="balanceMethod" type="radio" value="CASH" />
              {{ t("methodCash") }}
            </label>
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="balanceMethod" type="radio" value="TRANSFER" />
              {{ t("methodTransfer") }}
            </label>
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="balanceMethod" type="radio" value="CREDIT_CARD" />
              {{ t("methodCard") }}
            </label>
          </div>
          <div v-if="balanceMethod === 'CREDIT_CARD'" class="mt-2">
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="balanceCardType" type="radio" value="VISA" />
              {{ t("cardVisa") }}
            </label>
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="balanceCardType" type="radio" value="MASTERCARD" />
              {{ t("cardMaster") }}
            </label>
            <label class="inline-flex items-center gap-1 mr-3">
              <input v-model="balanceCardType" type="radio" value="OTHER" />
              {{ t("cardOther") }}
            </label>
          </div>
        </div>
      </section>

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
