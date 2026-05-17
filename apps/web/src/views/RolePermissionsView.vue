<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchRoles, fetchPermissions, updateRolePermissions, type Permission } from "../api/roles";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const roleId = Number(route.params.id);
const roleName = ref("");
const permissions = ref<Permission[]>([]);
const selected = ref<Set<string>>(new Set());
const error = ref<string | null>(null);

onMounted(async () => {
  permissions.value = await fetchPermissions();
  const role = (await fetchRoles()).find((r) => r.id === roleId);
  if (role) {
    roleName.value = role.name;
    selected.value = new Set(role.permissionKeys);
  }
});

function toggle(key: string): void {
  if (selected.value.has(key)) selected.value.delete(key);
  else selected.value.add(key);
  selected.value = new Set(selected.value);
}

async function save(): Promise<void> {
  error.value = null;
  try {
    await updateRolePermissions(roleId, [...selected.value]);
    router.replace("/roles");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}
</script>

<template>
  <section>
    <h2>{{ t("roles") }} — {{ roleName }}</h2>
    <ul>
      <li v-for="p in permissions" :key="p.key">
        <label>
          <input
            type="checkbox"
            :checked="selected.has(p.key)"
            :disabled="!auth.hasPermission('roles.manage')"
            @change="toggle(p.key)"
          />
          {{ p.description }} <code>({{ p.key }})</code>
        </label>
      </li>
    </ul>
    <p v-if="error" class="error">{{ error }}</p>
    <button v-if="auth.hasPermission('roles.manage')" type="button" @click="save">
      {{ t("save") }}
    </button>
    <RouterLink to="/roles">{{ t("cancel") }}</RouterLink>
  </section>
</template>
