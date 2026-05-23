import { defineStore } from "pinia";
import { ref } from "vue";
import * as authApi from "../api/auth";
import type { CurrentUser } from "../api/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<CurrentUser | null>(null);
  const ready = ref(false);

  async function loadMe(): Promise<void> {
    try {
      user.value = await authApi.fetchMe();
    } catch {
      user.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function login(username: string, password: string): Promise<void> {
    await authApi.login(username, password);
    await loadMe();
  }

  async function logout(): Promise<void> {
    // Clear local state immediately so the UI reacts before any network
    // round-trip — Render's free tier may take ~30s to wake from sleep,
    // and the user pressing "log out" should not be held hostage to it.
    user.value = null;
    // Server-side session cleanup is best-effort; the cookie still works
    // its way to expiry via maxAge, and re-login replaces it cleanly.
    authApi.logout().catch(() => {});
  }

  function hasPermission(key: string): boolean {
    return user.value?.permissions.includes(key) ?? false;
  }

  return { user, ready, loadMe, login, logout, hasPermission };
});
