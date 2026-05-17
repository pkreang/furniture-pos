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
  <section>
    <h2>{{ t("users") }}</h2>
    <form @submit.prevent="submit">
      <label>{{ t("username") }}
        <input v-model="form.username" :disabled="editingId !== null" />
      </label>
      <label>ชื่อ<input v-model="form.name" /></label>
      <label v-if="editingId === null">{{ t("password") }}
        <input v-model="form.password" type="password" minlength="8" />
      </label>
      <label>{{ t("roles") }}
        <select v-model.number="form.roleId">
          <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
      <label>{{ t("branches") }}
        <select v-model.number="form.branchId">
          <option :value="null">—</option>
          <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </label>
      <label v-if="editingId !== null">
        <input v-model="form.isActive" type="checkbox" /> ใช้งานอยู่
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit">{{ t("save") }}</button>
      <RouterLink to="/users">{{ t("cancel") }}</RouterLink>
    </form>
  </section>
</template>
