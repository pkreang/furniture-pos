<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchCustomer, createCustomer, updateCustomer } from "../api/customers";
import type { BillingType } from "../api/sales-orders";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));
const error = ref<string | null>(null);

const form = ref({
  name: "",
  phone: "",
  phone2: "",
  email: "",
  taxId: "",
  taxName: "",
  taxAddress: "",
  billingType: "" as BillingType | "",
  billingBranchNo: "",
  addrLine1: "",
  addrMoo: "",
  addrSoi: "",
  addrStreet: "",
  addrKwang: "",
  addrDistrict: "",
  addrProvince: "",
  addrPostal: "",
});

onMounted(async () => {
  if (editingId.value !== null) {
    const existing = await fetchCustomer(editingId.value);
    form.value = {
      name: existing.name,
      phone: existing.phone,
      phone2: existing.phone2 ?? "",
      email: existing.email ?? "",
      taxId: existing.taxId ?? "",
      taxName: existing.taxName ?? "",
      taxAddress: existing.taxAddress ?? "",
      billingType: existing.billingType ?? "",
      billingBranchNo: existing.billingBranchNo ?? "",
      addrLine1: existing.addrLine1 ?? "",
      addrMoo: existing.addrMoo ?? "",
      addrSoi: existing.addrSoi ?? "",
      addrStreet: existing.addrStreet ?? "",
      addrKwang: existing.addrKwang ?? "",
      addrDistrict: existing.addrDistrict ?? "",
      addrProvince: existing.addrProvince ?? "",
      addrPostal: existing.addrPostal ?? "",
    };
  }
});

function buildPayload(): Record<string, string | undefined> {
  return {
    name: form.value.name,
    phone2: form.value.phone2 || undefined,
    email: form.value.email || undefined,
    taxId: form.value.taxId || undefined,
    taxName: form.value.taxName || undefined,
    taxAddress: form.value.taxAddress || undefined,
    billingType: form.value.billingType || undefined,
    billingBranchNo: form.value.billingBranchNo || undefined,
    addrLine1: form.value.addrLine1 || undefined,
    addrMoo: form.value.addrMoo || undefined,
    addrSoi: form.value.addrSoi || undefined,
    addrStreet: form.value.addrStreet || undefined,
    addrKwang: form.value.addrKwang || undefined,
    addrDistrict: form.value.addrDistrict || undefined,
    addrProvince: form.value.addrProvince || undefined,
    addrPostal: form.value.addrPostal || undefined,
  };
}

async function submit(): Promise<void> {
  error.value = null;
  try {
    const payload = buildPayload();
    if (editingId.value !== null) {
      await updateCustomer(editingId.value, payload as Parameters<typeof updateCustomer>[1]);
    } else {
      await createCustomer({ ...payload, phone: form.value.phone } as Parameters<typeof createCustomer>[0]);
    }
    router.replace("/customers");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("customer") }}</h1>
    <div class="card max-w-2xl">
      <form @submit.prevent="submit">
        <div class="form-row">
          <label>{{ t("customer") }}</label>
          <input v-model="form.name" class="input" />
        </div>
        <div class="form-row">
          <label>{{ t("phone") }}</label>
          <input v-model="form.phone" :disabled="editingId !== null" class="input disabled:bg-slate-100 dark:bg-slate-800" />
        </div>
        <div class="form-row">
          <label>{{ t("phone2") }}</label>
          <input v-model="form.phone2" class="input" />
        </div>
        <div class="form-row">
          <label>{{ t("email") }}</label>
          <input v-model="form.email" type="email" class="input" />
        </div>
        <fieldset class="border border-slate-200 dark:border-slate-700 rounded-md p-4 mb-4">
          <legend class="text-sm font-semibold text-slate-700 dark:text-slate-300 px-2">{{ t("taxId") }}</legend>
          <div class="form-row">
            <label>{{ t("taxId") }}</label>
            <input v-model="form.taxId" class="input" />
          </div>
          <div class="form-row">
            <label>{{ t("taxName") }}</label>
            <input v-model="form.taxName" class="input" />
          </div>
          <div class="form-row mb-0">
            <label>{{ t("taxAddress") }}</label>
            <input v-model="form.taxAddress" class="input" />
          </div>
        </fieldset>
        <fieldset class="border border-slate-200 dark:border-slate-700 rounded-md p-4 mb-4">
          <legend class="text-sm font-semibold text-slate-700 dark:text-slate-300 px-2">{{ t("address") }}</legend>
          <div class="form-row">
            <label>{{ t("billingType") }}</label>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2 text-sm">
                <input type="radio" v-model="form.billingType" value="HEAD_OFFICE" /> {{ t("headOffice") }}
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input type="radio" v-model="form.billingType" value="BRANCH" /> {{ t("branchOffice") }}
              </label>
            </div>
          </div>
          <div v-if="form.billingType === 'BRANCH'" class="form-row">
            <label>{{ t("branchNo") }}</label>
            <input v-model="form.billingBranchNo" class="input" />
          </div>
          <div class="form-row">
            <label>{{ t("addrLine1") }}</label>
            <input v-model="form.addrLine1" class="input" />
          </div>
          <div class="grid grid-cols-3 gap-3 mb-3">
            <label class="block text-sm">
              <span class="block text-slate-600 dark:text-slate-400 mb-1">{{ t("addrMoo") }}</span>
              <input v-model="form.addrMoo" class="input" />
            </label>
            <label class="block text-sm">
              <span class="block text-slate-600 dark:text-slate-400 mb-1">{{ t("addrSoi") }}</span>
              <input v-model="form.addrSoi" class="input" />
            </label>
            <label class="block text-sm">
              <span class="block text-slate-600 dark:text-slate-400 mb-1">{{ t("addrStreet") }}</span>
              <input v-model="form.addrStreet" class="input" />
            </label>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <label class="block text-sm">
              <span class="block text-slate-600 dark:text-slate-400 mb-1">{{ t("addrKwang") }}</span>
              <input v-model="form.addrKwang" class="input" />
            </label>
            <label class="block text-sm">
              <span class="block text-slate-600 dark:text-slate-400 mb-1">{{ t("addrDistrict") }}</span>
              <input v-model="form.addrDistrict" class="input" />
            </label>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="block text-slate-600 dark:text-slate-400 mb-1">{{ t("addrProvince") }}</span>
              <input v-model="form.addrProvince" class="input" />
            </label>
            <label class="block text-sm">
              <span class="block text-slate-600 dark:text-slate-400 mb-1">{{ t("addrPostal") }}</span>
              <input v-model="form.addrPostal" class="input" />
            </label>
          </div>
        </fieldset>
        <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary">{{ t("save") }}</button>
          <RouterLink to="/customers" class="btn-secondary">{{ t("cancel") }}</RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
