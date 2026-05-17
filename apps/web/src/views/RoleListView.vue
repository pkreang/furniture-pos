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
  <section>
    <h2>{{ t("roles") }}</h2>
    <p v-if="error" class="error">{{ error }}</p>
    <ul v-else>
      <li v-for="r in roles" :key="r.id">
        <RouterLink :to="`/roles/${r.id}`">{{ r.name }}</RouterLink>
        — {{ r.permissionKeys.length }} สิทธิ์
      </li>
    </ul>
  </section>
</template>
