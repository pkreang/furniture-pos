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
  <section>
    <h2>{{ t("importExport") }}</h2>
    <p v-if="error" class="error">{{ error }}</p>

    <table>
      <thead>
        <tr><th></th><th>{{ t("exportData") }}</th><th>{{ t("importData") }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="entity in entities" :key="entity">
          <td>{{ entity }}</td>
          <td>
            <button type="button" @click="doExport(entity)">{{ t("exportData") }} .xlsx</button>
          </td>
          <td>
            <input
              type="file"
              accept=".xlsx,.xls"
              @change="(e) => doImport(entity, e)"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="result">
      <h3>{{ t("result") }} — {{ result.entity }}</h3>
      <p>{{ t("importData") }}: {{ result.data.created }}</p>
      <ul>
        <li v-for="err in result.data.errors" :key="err.row" class="error">
          แถว {{ err.row }}: {{ err.message }}
        </li>
      </ul>
    </div>
  </section>
</template>
