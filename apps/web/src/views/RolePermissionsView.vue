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
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("roles") }} — {{ roleName }}</h1>
    <div class="card mb-4">
      <ul class="space-y-2">
        <li v-for="p in permissions" :key="p.key">
          <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-normal">
            <input
              type="checkbox"
              :checked="selected.has(p.key)"
              :disabled="!auth.hasPermission('roles.manage')"
              @change="toggle(p.key)"
            />
            {{ p.description }} <code class="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-600 dark:text-slate-300">({{ p.key }})</code>
          </label>
        </li>
      </ul>
    </div>
    <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
    <div class="flex items-center gap-3">
      <button v-if="auth.hasPermission('roles.manage')" type="button" class="btn-primary" @click="save">
        {{ t("save") }}
      </button>
      <RouterLink to="/roles" class="btn-secondary">{{ t("cancel") }}</RouterLink>
    </div>
  </div>
</template>
