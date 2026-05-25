<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { fetchDashboard, type Dashboard } from "../api/reports";
import { useEventsStore } from "../stores/events";

const { t } = useI18n();
const events = useEventsStore();

const data = ref<Dashboard | null>(null);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  error.value = null;
  try {
    data.value = await fetchDashboard();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown error";
  }
}

watch(() => events.tick, load);
onMounted(load);

const branchMax = computed(() =>
  Math.max(1, ...(data.value?.salesByBranch ?? []).map((b) => b.total)),
);
const monthMax = computed(() =>
  Math.max(1, ...(data.value?.salesByMonth ?? []).map((m) => m.total)),
);

function fmt(n: number): string {
  return n.toLocaleString();
}

function monthLabel(ym: string): string {
  const [, m] = ym.split("-");
  const names = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return names[Number(m) - 1] ?? ym;
}

const rankColors = ["text-amber-500", "text-slate-400", "text-amber-700"];
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">{{ t("dashboard") }}</h1>
    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>

    <template v-if="data">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="card">
          <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
            {{ t("today") }} — {{ t("sales") }}
          </h3>
          <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {{ data.todaySalesCount }}
            <span class="text-base font-normal text-slate-500 dark:text-slate-400">{{ t("billUnit") }}</span>
          </p>
          <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">
            {{ fmt(data.todaySalesTotal) }} {{ t("bahtUnit") }}
          </p>
        </div>
        <div class="card">
          <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">{{ t("outstanding") }}</h3>
          <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {{ fmt(data.outstandingTotal) }}
            <span class="text-base font-normal text-slate-500 dark:text-slate-400">{{ t("bahtUnit") }}</span>
          </p>
        </div>
        <div class="card">
          <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">{{ t("pendingDeliveries") }}</h3>
          <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ data.pendingDeliveries }}</p>
        </div>
        <div class="card">
          <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">{{ t("lowStock") }}</h3>
          <p class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ data.lowStockCount }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div class="card">
          <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
            {{ t("dashSalesByBranch") }} — {{ t("today") }}
          </h3>
          <p v-if="!data.salesByBranch.length" class="text-sm text-slate-400">{{ t("noData") }}</p>
          <ul v-else class="space-y-3">
            <li v-for="b in data.salesByBranch" :key="b.branchId">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-slate-700 dark:text-slate-200">{{ b.name }}</span>
                <span class="font-mono text-slate-600 dark:text-slate-300">{{ fmt(b.total) }}</span>
              </div>
              <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  class="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all"
                  :style="{ width: (b.total / branchMax) * 100 + '%' }"
                ></div>
              </div>
            </li>
          </ul>
        </div>

        <div class="card">
          <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
            {{ t("dashTopProducts") }}
          </h3>
          <p v-if="!data.topProducts.length" class="text-sm text-slate-400">{{ t("noData") }}</p>
          <ol v-else class="space-y-2">
            <li
              v-for="(p, i) in data.topProducts"
              :key="p.productId"
              class="flex items-center gap-3 text-sm"
            >
              <span
                class="inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs"
                :class="i < 3 ? rankColors[i] + ' bg-slate-100 dark:bg-slate-700' : 'text-slate-500 bg-slate-50 dark:bg-slate-800'"
              >
                {{ i + 1 }}
              </span>
              <span class="flex-1 truncate text-slate-800 dark:text-slate-100">{{ p.name }}</span>
              <span class="font-mono text-xs text-slate-500 dark:text-slate-400">×{{ p.qty }}</span>
              <span class="font-mono text-slate-700 dark:text-slate-200 tabular-nums">{{ fmt(p.total) }}</span>
            </li>
          </ol>
        </div>
      </div>

      <div class="card">
        <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
          {{ t("dashSalesByMonth") }}
        </h3>
        <p v-if="!data.salesByMonth.some((m) => m.total > 0)" class="text-sm text-slate-400">
          {{ t("noData") }}
        </p>
        <svg
          v-else
          :viewBox="`0 0 ${data.salesByMonth.length * 60} 200`"
          class="w-full h-48"
          aria-hidden="true"
        >
          <g v-for="(m, i) in data.salesByMonth" :key="m.month">
            <rect
              :x="i * 60 + 10"
              :y="180 - (m.total / monthMax) * 150"
              width="40"
              :height="(m.total / monthMax) * 150"
              rx="3"
              class="fill-indigo-500 dark:fill-indigo-400"
            />
            <text
              :x="i * 60 + 30"
              :y="170 - (m.total / monthMax) * 150"
              text-anchor="middle"
              class="fill-slate-600 dark:fill-slate-300 text-[10px] font-mono"
            >
              {{ m.total > 0 ? fmt(m.total) : "" }}
            </text>
            <text
              :x="i * 60 + 30"
              y="196"
              text-anchor="middle"
              class="fill-slate-500 dark:fill-slate-400 text-[11px]"
            >
              {{ monthLabel(m.month) }}
            </text>
          </g>
        </svg>
      </div>
    </template>
  </div>
</template>
