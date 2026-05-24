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
    user.value = null;
    try {
      await authApi.logout();
    } catch {
      // Best-effort: local state is already cleared and the user sees themselves
      // logged out. If the server call failed (network blip / cold start
      // timeout) the session row in the DB and the cookie remain until they
      // expire on their own — a tab refresh could pick them back up.
    }
  }

  function hasPermission(key: string): boolean {
    return user.value?.permissions.includes(key) ?? false;
  }

  return { user, ready, loadMe, login, logout, hasPermission };
});
