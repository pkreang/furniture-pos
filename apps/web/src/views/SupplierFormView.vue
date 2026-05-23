<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchSupplier, createSupplier, updateSupplier } from "../api/suppliers";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));
const error = ref<string | null>(null);

const form = ref({
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  taxId: "",
  notes: "",
  isActive: true,
});

onMounted(async () => {
  if (editingId.value !== null) {
    const existing = await fetchSupplier(editingId.value);
    form.value = {
      name: existing.name,
      contactName: existing.contactName ?? "",
      phone: existing.phone ?? "",
      email: existing.email ?? "",
      address: existing.address ?? "",
      taxId: existing.taxId ?? "",
      notes: existing.notes ?? "",
      isActive: existing.isActive,
    };
  }
});

async function submit(): Promise<void> {
  error.value = null;
  if (!form.value.name.trim()) {
    error.value = t("supplier") + ": " + t("search");
    return;
  }
  try {
    const payload = {
      name: form.value.name.trim(),
      contactName: form.value.contactName.trim() || undefined,
      phone: form.value.phone.trim() || undefined,
      email: form.value.email.trim() || undefined,
      address: form.value.address.trim() || undefined,
      taxId: form.value.taxId.trim() || undefined,
      notes: form.value.notes.trim() || undefined,
      isActive: form.value.isActive,
    };
    if (editingId.value !== null) {
      await updateSupplier(editingId.value, payload);
    } else {
      await createSupplier(payload);
    }
    router.replace("/suppliers");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("supplier") }}</h1>
    <div class="card max-w-2xl">
      <form @submit.prevent="submit">
        <div class="form-row">
          <label>{{ t("supplier") }}</label>
          <input v-model="form.name" class="input" required />
        </div>
        <div class="form-row">
          <label>{{ t("contactName") }}</label>
          <input v-model="form.contactName" class="input" />
        </div>
        <div class="form-row">
          <label>{{ t("phone") }}</label>
          <input v-model="form.phone" class="input" />
        </div>
        <div class="form-row">
          <label>{{ t("email") }}</label>
          <input v-model="form.email" type="email" class="input" />
        </div>
        <div class="form-row">
          <label>{{ t("address") }}</label>
          <textarea v-model="form.address" class="input" rows="2"></textarea>
        </div>
        <div class="form-row">
          <label>{{ t("taxId") }}</label>
          <input v-model="form.taxId" class="input" />
        </div>
        <div class="form-row">
          <label>{{ t("notes") }}</label>
          <textarea v-model="form.notes" class="input" rows="3"></textarea>
        </div>
        <div class="form-row">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.isActive" type="checkbox" />
            <span>{{ t("active") }}</span>
          </label>
        </div>
        <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary">{{ t("save") }}</button>
          <RouterLink to="/suppliers" class="btn-secondary">{{ t("cancel") }}</RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
