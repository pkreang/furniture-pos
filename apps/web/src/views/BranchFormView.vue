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
  <section>
    <h2>{{ t("branches") }}</h2>
    <form @submit.prevent="submit">
      <label>ชื่อ<input v-model="form.name" /></label>
      <label>รหัส<input v-model="form.code" /></label>
      <label><input v-model="form.isWarehouse" type="checkbox" /> เป็นคลังสินค้า</label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit">{{ t("save") }}</button>
      <RouterLink to="/branches">{{ t("cancel") }}</RouterLink>
    </form>
  </section>
</template>
