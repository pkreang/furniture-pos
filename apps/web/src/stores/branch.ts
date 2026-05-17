import { defineStore } from "pinia";
import { ref } from "vue";
import { fetchBranches, type Branch } from "../api/branches";

export const useBranchStore = defineStore("branch", () => {
  const branches = ref<Branch[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      branches.value = await fetchBranches();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "unknown error";
    } finally {
      loading.value = false;
    }
  }

  return { branches, loading, error, load };
});
