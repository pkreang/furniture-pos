<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth";

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const username = ref("");
const password = ref("");
const error = ref<string | null>(null);
const busy = ref(false);

async function submit(): Promise<void> {
  error.value = null;
  busy.value = true;
  try {
    await auth.login(username.value, password.value);
    router.replace(auth.user?.mustChangePassword ? "/change-password" : "/");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen relative overflow-hidden bg-stone-950">
    <div
      class="absolute inset-0 bg-cover bg-center"
      style="background-image: url('/login-hero.jpg')"
    ></div>
    <div class="absolute inset-0 bg-stone-950/55"></div>

    <div class="hidden md:block absolute top-8 left-8 lg:top-12 lg:left-12 text-white z-10">
      <p class="text-[11px] tracking-[0.4em] uppercase text-amber-200/80">
        {{ t("appName") }}
      </p>
      <h2 class="font-serif text-3xl lg:text-4xl mt-2 leading-tight">Elite Design</h2>
    </div>

    <div
      class="hidden lg:block absolute bottom-12 left-12 text-white max-w-md z-10"
    >
      <p class="font-serif italic text-xl xl:text-2xl leading-snug text-stone-100">
        ทุกชิ้นงาน คือความใส่ใจ
      </p>
      <p class="mt-3 text-sm text-stone-300/85 leading-relaxed">
        ระบบจัดการร้านเฟอร์นิเจอร์ครบวงจร — เปิดบิล สั่งจอง จัดส่ง และรายงาน ในที่เดียว
      </p>
      <p class="mt-6 text-xs tracking-wider text-stone-300/60">
        © {{ new Date().getFullYear() }} Elite Design Furniture
      </p>
    </div>

    <main class="relative min-h-screen flex items-center justify-center p-6">
      <div
        class="w-full max-w-sm bg-white/90 dark:bg-slate-900/85 backdrop-blur-md rounded-xl border border-white/40 dark:border-slate-700/50 shadow-2xl p-8"
      >
        <div class="mb-6">
          <p
            class="text-[11px] tracking-[0.4em] uppercase text-amber-700 dark:text-amber-300 md:hidden"
          >
            {{ t("appName") }}
          </p>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {{ t("login") }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ลงชื่อเข้าใช้เพื่อเริ่มทำงาน
          </p>
        </div>
        <form @submit.prevent="submit" novalidate>
          <div class="form-row">
            <label>{{ t("username") }}</label>
            <input
              v-model="username"
              class="input"
              autocomplete="username"
              autofocus
              required
            />
          </div>
          <div class="form-row">
            <label>{{ t("password") }}</label>
            <input
              v-model="password"
              type="password"
              class="input"
              autocomplete="current-password"
              required
            />
          </div>
          <p v-if="error" class="text-red-600 dark:text-red-400 text-sm mb-3">{{ error }}</p>
          <button
            type="submit"
            :disabled="busy"
            class="btn-primary w-full justify-center py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg
              v-if="busy"
              class="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
            {{ t("login") }}
          </button>
        </form>
      </div>
    </main>
  </div>
</template>
