<script setup lang="ts">
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>

<template>
  <header>
    <h1>{{ t("appName") }}</h1>
  </header>
  <main>
    <RouterView />
  </main>
</template>
