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
  <section>
    <h2>{{ t("customer") }}</h2>
    <form @submit.prevent="submit">
      <label>{{ t("customer") }}<input v-model="form.name" /></label>
      <label>{{ t("phone") }}
        <input v-model="form.phone" :disabled="editingId !== null" />
      </label>
      <label>{{ t("email") }}<input v-model="form.email" type="email" /></label>
      <fieldset>
        <legend>{{ t("taxId") }}</legend>
        <label>{{ t("taxId") }}<input v-model="form.taxId" /></label>
        <label>{{ t("taxName") }}<input v-model="form.taxName" /></label>
        <label>{{ t("taxAddress") }}<input v-model="form.taxAddress" /></label>
      </fieldset>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit">{{ t("save") }}</button>
      <RouterLink to="/customers">{{ t("cancel") }}</RouterLink>
    </form>
  </section>
</template>
