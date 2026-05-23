<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchCustomer, createCustomer, updateCustomer } from "../api/customers";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));
const error = ref<string | null>(null);

const form = ref({
  name: "",
  phone: "",
  email: "",
  taxId: "",
  taxName: "",
  taxAddress: "",
});

onMounted(async () => {
  if (editingId.value !== null) {
    const existing = await fetchCustomer(editingId.value);
    form.value = {
      name: existing.name,
      phone: existing.phone,
      email: existing.email ?? "",
      taxId: existing.taxId ?? "",
      taxName: existing.taxName ?? "",
      taxAddress: existing.taxAddress ?? "",
    };
  }
});

async function submit(): Promise<void> {
  error.value = null;
  try {
    if (editingId.value !== null) {
      await updateCustomer(editingId.value, {
        name: form.value.name,
        email: form.value.email || undefined,
        taxId: form.value.taxId || undefined,
        taxName: form.value.taxName || undefined,
        taxAddress: form.value.taxAddress || undefined,
      });
    } else {
      await createCustomer({
        name: form.value.name,
        phone: form.value.phone,
        email: form.value.email || undefined,
        taxId: form.value.taxId || undefined,
        taxName: form.value.taxName || undefined,
        taxAddress: form.value.taxAddress || undefined,
      });
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
        <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary">{{ t("save") }}</button>
          <RouterLink to="/customers" class="btn-secondary">{{ t("cancel") }}</RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
