<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetchRoles, type Role } from "../api/roles";

const { t } = useI18n();
const roles = ref<Role[]>([]);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    roles.value = await fetchRoles();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
});
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900">{{ t("roles") }}</h1>
    <p v-if="error" class="text-red-600">{{ error }}</p>
    <div v-else class="card">
      <ul class="divide-y divide-slate-200">
        <li v-for="r in roles" :key="r.id" class="py-3 flex items-center justify-between">
          <RouterLink :to="`/roles/${r.id}`" class="text-indigo-600 hover:text-indigo-700 font-medium">{{ r.name }}</RouterLink>
          <span class="text-sm text-slate-500">{{ r.permissionKeys.length }} สิทธิ์</span>
        </li>
      </ul>
    </div>
  </div>
</template>
