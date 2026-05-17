<script setup lang="ts">
import { onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useBranchStore } from "../stores/branch";

const { t } = useI18n();
const store = useBranchStore();

onMounted(() => store.load());
</script>

<template>
  <section>
    <h2>{{ t("branches") }}</h2>
    <p v-if="store.loading">…</p>
    <p v-else-if="store.error">{{ store.error }}</p>
    <ul v-else>
      <li v-for="b in store.branches" :key="b.id">
        {{ b.name }} ({{ b.code }})
      </li>
    </ul>
  </section>
</template>
