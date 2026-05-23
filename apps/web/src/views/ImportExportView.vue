<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import * as XLSX from "xlsx";
import { exportData, importData, type ImportEntity, type ImportResult } from "../api/admin";

const { t } = useI18n();

const entities: ImportEntity[] = ["products", "customers", "stock"];
const error = ref<string | null>(null);
const result = ref<{ entity: string; data: ImportResult } | null>(null);

async function doExport(entity: ImportEntity): Promise<void> {
  error.value = null;
  try {
    const rows = await exportData(entity);
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, entity);
    XLSX.writeFile(book, `${entity}.xlsx`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "ส่งออกไม่สำเร็จ";
  }
}

async function doImport(entity: ImportEntity, event: Event): Promise<void> {
  error.value = null;
  result.value = null;
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const book = XLSX.read(await file.arrayBuffer());
    const sheet = book.Sheets[book.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    result.value = { entity, data: await importData(entity, rows) };
  } catch (e) {
    error.value = e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ";
  }
}
</script>

<template>
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-2xl font-bold mb-4 text-slate-900">{{ t("importExport") }}</h1>
    <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>

    <div class="card overflow-x-auto mb-4">
      <table class="data-table">
        <thead>
          <tr><th></th><th>{{ t("exportData") }}</th><th>{{ t("importData") }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="entity in entities" :key="entity">
            <td class="font-medium text-slate-800">{{ entity }}</td>
            <td>
              <button type="button" class="btn-secondary" @click="doExport(entity)">{{ t("exportData") }} .xlsx</button>
            </td>
            <td>
              <input
                type="file"
                accept=".xlsx,.xls"
                class="text-sm"
                @change="(e) => doImport(entity, e)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="result" class="card">
      <h2 class="text-lg font-semibold mb-3 text-slate-800">{{ t("result") }} — {{ result.entity }}</h2>
      <p class="text-sm text-slate-700 mb-2">{{ t("importData") }}: {{ result.data.created }}</p>
      <ul class="space-y-1">
        <li v-for="err in result.data.errors" :key="err.row" class="text-sm text-red-600">
          แถว {{ err.row }}: {{ err.message }}
        </li>
      </ul>
    </div>
  </div>
</template>
