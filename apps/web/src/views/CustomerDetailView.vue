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
  <section>
    <p v-if="loading">…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <template v-else-if="customer">
      <header>
        <h2>{{ customer.name }}</h2>
        <RouterLink v-if="canManage" :to="`/customers/${customer.id}/edit`">{{ t("save") }}</RouterLink>
      </header>
      <dl>
        <dt>{{ t("phone") }}</dt><dd>{{ customer.phone }}</dd>
        <dt>{{ t("email") }}</dt><dd>{{ customer.email || "—" }}</dd>
        <dt>{{ t("tier") }}</dt><dd>{{ customer.tier.name }}</dd>
        <dt>{{ t("points") }}</dt><dd>{{ customer.pointsBalance }}</dd>
        <dt>{{ t("taxId") }}</dt><dd>{{ customer.taxId || "—" }}</dd>
        <dt>{{ t("taxName") }}</dt><dd>{{ customer.taxName || "—" }}</dd>
        <dt>{{ t("taxAddress") }}</dt><dd>{{ customer.taxAddress || "—" }}</dd>
      </dl>

      <form v-if="canManage" @submit.prevent="submitAdjust">
        <h3>{{ t("points") }} (+/-)</h3>
        <label>{{ t("points") }}<input v-model.number="adjustForm.delta" type="number" /></label>
        <label>หมายเหตุ<input v-model="adjustForm.note" /></label>
        <button type="submit">{{ t("save") }}</button>
      </form>

      <h3>{{ t("points") }}</h3>
      <table>
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

      <RouterLink to="/customers">{{ t("cancel") }}</RouterLink>
    </template>
  </section>
</template>
