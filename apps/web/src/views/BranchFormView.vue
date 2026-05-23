<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchBranches, createBranch, updateBranch } from "../api/branches";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));
const error = ref<string | null>(null);
const form = ref({ name: "", code: "", isWarehouse: false });

onMounted(async () => {
  if (editingId.value !== null) {
    const existing = (await fetchBranches()).find((b) => b.id === editingId.value);
    if (existing) {
      form.value = { name: existing.name, code: existing.code, isWarehouse: existing.isWarehouse };
    }
  }
});

async function submit(): Promise<void> {
  error.value = null;
  try {
    if (editingId.value !== null) {
      await updateBranch(editingId.value, form.value);
    } else {
      await createBranch(form.value);
    }
    router.replace("/branches");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900">{{ t("branches") }}</h1>
    <div class="card max-w-lg">
      <form @submit.prevent="submit">
        <div class="form-row">
          <label>ชื่อ</label>
          <input v-model="form.name" class="input" />
        </div>
        <div class="form-row">
          <label>รหัส</label>
          <input v-model="form.code" class="input" />
        </div>
        <div class="form-row">
          <label class="flex items-center gap-2 font-normal">
            <input v-model="form.isWarehouse" type="checkbox" /> เป็นคลังสินค้า
          </label>
        </div>
        <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary">{{ t("save") }}</button>
          <RouterLink to="/branches" class="btn-secondary">{{ t("cancel") }}</RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
