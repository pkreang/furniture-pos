<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "./stores/auth";

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const signedIn = computed(() => auth.user !== null);

async function doLogout(): Promise<void> {
  await auth.logout();
  router.replace("/login");
}
</script>

<template>
  <header>
    <h1>{{ t("appName") }}</h1>
    <nav v-if="signedIn">
      <RouterLink v-if="auth.hasPermission('sales.create')" to="/pos">{{ t("pos") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('sales.view')" to="/sales">{{ t("sales") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('sales.view')" to="/outstanding">{{ t("outstanding") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('quotations.view')" to="/quotations">{{ t("quotations") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('delivery.view')" to="/deliveries">{{ t("deliveries") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('delivery.view')" to="/delivery-settings">{{ t("deliverySettings") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('branches.view')" to="/branches">{{ t("branches") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('catalog.view')" to="/categories">{{ t("categories") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('catalog.view')" to="/products">{{ t("products") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('stock.view')" to="/stock">{{ t("stock") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('stock.view')" to="/transfers">{{ t("transfers") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('customers.view')" to="/customers">{{ t("customers") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('users.view')" to="/users">{{ t("users") }}</RouterLink>
      <RouterLink v-if="auth.hasPermission('roles.view')" to="/roles">{{ t("roles") }}</RouterLink>
      <span>{{ auth.user?.name }}</span>
      <button type="button" @click="doLogout">{{ t("logout") }}</button>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>
