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
  <section>
    <header>
      <h2>{{ t("branches") }}</h2>
      <RouterLink v-if="auth.hasPermission('branches.manage')" to="/branches/new">
        + {{ t("branches") }}
      </RouterLink>
    </header>
    <p v-if="store.loading">…</p>
    <p v-else-if="store.error" class="error">{{ store.error }}</p>
    <ul v-else>
      <li v-for="b in store.branches" :key="b.id">
        {{ b.name }} ({{ b.code }})
        <RouterLink v-if="auth.hasPermission('branches.manage')" :to="`/branches/${b.id}/edit`">
          {{ t("save") }}
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
