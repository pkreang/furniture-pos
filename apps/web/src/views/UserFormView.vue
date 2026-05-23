<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchUsers, createUser, updateUser } from "../api/users";
import { fetchRoles, type Role } from "../api/roles";
import { fetchBranches, type Branch } from "../api/branches";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null));
const roles = ref<Role[]>([]);
const branches = ref<Branch[]>([]);
const error = ref<string | null>(null);

const form = ref({
  username: "",
  name: "",
  password: "",
  roleId: 0,
  branchId: null as number | null,
  isActive: true,
});

onMounted(async () => {
  roles.value = await fetchRoles();
  branches.value = await fetchBranches();
  if (roles.value[0]) form.value.roleId = roles.value[0].id;
  if (editingId.value !== null) {
    const existing = (await fetchUsers()).find((u) => u.id === editingId.value);
    if (existing) {
      form.value.username = existing.username;
      form.value.name = existing.name;
      form.value.roleId = existing.roleId;
      form.value.branchId = existing.branchId;
      form.value.isActive = existing.isActive;
    }
  }
});

async function submit(): Promise<void> {
  error.value = null;
  try {
    if (editingId.value !== null) {
      await updateUser(editingId.value, {
        name: form.value.name,
        roleId: form.value.roleId,
        branchId: form.value.branchId,
        isActive: form.value.isActive,
      });
    } else {
      await createUser({
        username: form.value.username,
        name: form.value.name,
        password: form.value.password,
        roleId: form.value.roleId,
        branchId: form.value.branchId,
      });
    }
    router.replace("/users");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "บันทึกไม่สำเร็จ";
  }
}
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{{ t("users") }}</h1>
    <div class="card max-w-2xl">
      <form @submit.prevent="submit">
        <div class="form-row">
          <label>{{ t("username") }}</label>
          <input v-model="form.username" :disabled="editingId !== null" class="input disabled:bg-slate-100 dark:bg-slate-800" />
        </div>
        <div class="form-row">
          <label>ชื่อ</label>
          <input v-model="form.name" class="input" />
        </div>
        <div v-if="editingId === null" class="form-row">
          <label>{{ t("password") }}</label>
          <input v-model="form.password" type="password" minlength="8" class="input" />
        </div>
        <div class="form-row">
          <label>{{ t("roles") }}</label>
          <select v-model.number="form.roleId" class="input">
            <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>{{ t("branches") }}</label>
          <select v-model.number="form.branchId" class="input">
            <option :value="null">—</option>
            <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div v-if="editingId !== null" class="form-row">
          <label class="flex items-center gap-2 font-normal">
            <input v-model="form.isActive" type="checkbox" /> ใช้งานอยู่
          </label>
        </div>
        <p v-if="error" class="text-red-600 text-sm mb-3">{{ error }}</p>
        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary">{{ t("save") }}</button>
          <RouterLink to="/users" class="btn-secondary">{{ t("cancel") }}</RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
