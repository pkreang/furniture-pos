<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useBranchStore } from "../stores/branch";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const store = useBranchStore();
const auth = useAuthStore();

onMounted(() => store.load());
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ t("branches") }}</h1>
      <RouterLink v-if="auth.hasPermission('branches.manage')" to="/branches/new" class="btn-primary">
        + {{ t("branches") }}
      </RouterLink>
    </header>
    <p v-if="store.loading" class="text-slate-500 dark:text-slate-400">…</p>
    <p v-else-if="store.error" class="text-red-600">{{ store.error }}</p>
    <div v-else class="card">
      <ul class="divide-y divide-slate-200">
        <li v-for="b in store.branches" :key="b.id" class="py-3 flex items-center justify-between">
          <span class="text-slate-800 dark:text-slate-200">{{ b.name }} <span class="text-slate-500 dark:text-slate-400">({{ b.code }})</span></span>
          <RouterLink
            v-if="auth.hasPermission('branches.manage')"
            :to="`/branches/${b.id}/edit`"
            class="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
          >
            {{ t("save") }}
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>
