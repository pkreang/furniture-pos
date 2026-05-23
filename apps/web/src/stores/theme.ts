import { defineStore } from "pinia";
import { ref } from "vue";

const STORAGE_KEY = "pos_theme";

function readInitial(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "dark") return true;
  if (saved === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function apply(isDark: boolean): void {
  document.documentElement.classList.toggle("dark", isDark);
}

export const useThemeStore = defineStore("theme", () => {
  const isDark = ref(false);

  function init(): void {
    isDark.value = readInitial();
    apply(isDark.value);
  }

  function toggle(): void {
    isDark.value = !isDark.value;
    localStorage.setItem(STORAGE_KEY, isDark.value ? "dark" : "light");
    apply(isDark.value);
  }

  return { isDark, init, toggle };
});
