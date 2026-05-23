<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { fetchCustomer, adjustPoints, type Customer } from "../api/customers";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const route = useRoute();
const auth = useAuthStore();

const customerId = Number(route.params.id);
const customer = ref<Customer | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);

const canManage = auth.hasPermission("customers.manage");
const adjustForm = ref({ delta: 0, note: "" });

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    customer.value = await fetchCustomer(customerId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  } finally {
    loading.value = false;
  }
}

async function submitAdjust(): Promise<void> {
  error.value = null;
  try {
    await adjustPoints(customerId, adjustForm.value.delta, adjustForm.value.note || undefined);
    adjustForm.value = { delta: 0, note: "" };
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ปรับแต้มไม่สำเร็จ";
  }
}

onMounted(load);
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <p v-if="loading" class="text-slate-500">…</p>
    <p v-else-if="error" class="text-red-600">{{ error }}</p>
    <template v-else-if="customer">
      <header class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-slate-900">{{ customer.name }}</h1>
        <RouterLink v-if="canManage" :to="`/customers/${customer.id}/edit`" class="btn-secondary">
          {{ t("save") }}
        </RouterLink>
      </header>
      <div class="card mb-4">
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt class="text-slate-500">{{ t("phone") }}</dt><dd class="text-slate-900 font-medium">{{ customer.phone }}</dd></div>
          <div><dt class="text-slate-500">{{ t("email") }}</dt><dd class="text-slate-900 font-medium">{{ customer.email || "—" }}</dd></div>
          <div><dt class="text-slate-500">{{ t("tier") }}</dt><dd class="text-slate-900 font-medium">{{ customer.tier.name }}</dd></div>
          <div><dt class="text-slate-500">{{ t("points") }}</dt><dd class="text-slate-900 font-medium">{{ customer.pointsBalance }}</dd></div>
          <div><dt class="text-slate-500">{{ t("taxId") }}</dt><dd class="text-slate-900 font-medium">{{ customer.taxId || "—" }}</dd></div>
          <div><dt class="text-slate-500">{{ t("taxName") }}</dt><dd class="text-slate-900 font-medium">{{ customer.taxName || "—" }}</dd></div>
          <div class="sm:col-span-2"><dt class="text-slate-500">{{ t("taxAddress") }}</dt><dd class="text-slate-900 font-medium">{{ customer.taxAddress || "—" }}</dd></div>
        </dl>
      </div>

      <div v-if="canManage" class="card mb-4">
        <h2 class="text-lg font-semibold mb-3 text-slate-800">{{ t("points") }} (+/-)</h2>
        <form @submit.prevent="submitAdjust">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-row">
              <label>{{ t("points") }}</label>
              <input v-model.number="adjustForm.delta" type="number" class="input" />
            </div>
            <div class="form-row">
              <label>หมายเหตุ</label>
              <input v-model="adjustForm.note" class="input" />
            </div>
          </div>
          <button type="submit" class="btn-primary">{{ t("save") }}</button>
        </form>
      </div>

      <h2 class="text-lg font-semibold mt-6 mb-3 text-slate-800">{{ t("points") }}</h2>
      <div class="card overflow-x-auto mb-4">
        <table class="data-table">
          <thead>
            <tr><th>{{ t("quantity") }}</th><th>เหตุผล</th><th>หมายเหตุ</th></tr>
          </thead>
          <tbody>
            <tr v-for="pt in customer.pointTransactions ?? []" :key="pt.id">
              <td>{{ pt.delta > 0 ? "+" : "" }}{{ pt.delta }}</td>
              <td>{{ pt.reason }}</td>
              <td>{{ pt.note || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <RouterLink to="/customers" class="btn-secondary">{{ t("cancel") }}</RouterLink>
    </template>
  </div>
</template>
