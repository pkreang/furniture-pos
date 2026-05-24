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
  <div class="min-h-screen flex">
    <aside class="hidden lg:flex lg:flex-1 relative overflow-hidden bg-stone-950">
      <div
        class="absolute inset-0 bg-gradient-to-br from-stone-950 via-stone-800 to-amber-950"
      ></div>
      <div
        class="absolute inset-0"
        style="
          background: radial-gradient(
            ellipse 80% 60% at 50% 45%,
            rgba(245, 158, 11, 0.32),
            transparent 65%
          );
        "
      ></div>
      <svg
        class="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 w-[78%] max-w-[640px] text-amber-200 opacity-60"
        viewBox="0 0 600 280"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <g opacity="0.55">
          <line x1="300" y1="-20" x2="300" y2="28" />
          <path d="M 278 50 Q 278 28 300 28 Q 322 28 322 50 L 318 60 L 282 60 Z" />
        </g>
        <rect x="30" y="125" width="60" height="140" rx="14" />
        <rect x="510" y="125" width="60" height="140" rx="14" />
        <rect x="95" y="85" width="135" height="105" rx="14" />
        <rect x="235" y="85" width="130" height="105" rx="14" />
        <rect x="370" y="85" width="135" height="105" rx="14" />
        <rect x="95" y="190" width="135" height="75" rx="14" />
        <rect x="235" y="190" width="130" height="75" rx="14" />
        <rect x="370" y="190" width="135" height="75" rx="14" />
        <g opacity="0.7">
          <rect
            x="115"
            y="200"
            width="55"
            height="45"
            rx="8"
            transform="rotate(-6 142 222)"
          />
          <rect
            x="430"
            y="200"
            width="55"
            height="45"
            rx="8"
            transform="rotate(6 458 222)"
          />
        </g>
        <line x1="55" y1="265" x2="55" y2="278" />
        <line x1="545" y1="265" x2="545" y2="278" />
        <line x1="30" y1="282" x2="570" y2="282" stroke-dasharray="3,6" opacity="0.5" />
      </svg>
      <div
        class="absolute inset-0 bg-cover bg-center opacity-55 mix-blend-overlay"
        style="background-image: url('/login-hero.jpg')"
      ></div>
      <div
        class="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-transparent to-stone-950/60"
      ></div>
      <div
        class="absolute inset-6 xl:inset-10 border border-amber-200/15 rounded-sm pointer-events-none"
      ></div>
      <div class="relative flex flex-col justify-between p-12 xl:p-16 text-white w-full">
        <div>
          <p class="text-[11px] tracking-[0.4em] uppercase text-amber-200/80">
            {{ t("appName") }}
          </p>
          <h2 class="font-serif text-5xl xl:text-6xl mt-3 leading-tight">Elite Design</h2>
        </div>
        <div class="max-w-md">
          <p class="font-serif italic text-2xl xl:text-3xl leading-snug text-stone-100">
            ทุกชิ้นงาน คือความใส่ใจ
          </p>
          <p class="mt-5 text-sm text-stone-300/80 leading-relaxed">
            ระบบจัดการร้านเฟอร์นิเจอร์ครบวงจร — เปิดบิล สั่งจอง จัดส่ง และรายงาน
            ในที่เดียว
          </p>
        </div>
        <p class="text-xs tracking-wider text-stone-400/60">
          © {{ new Date().getFullYear() }} Elite Design Furniture
        </p>
      </div>
    </aside>

    <main class="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-slate-900">
      <div class="w-full max-w-sm">
        <div class="mb-8">
          <p
            class="text-[11px] tracking-[0.4em] uppercase text-amber-700 dark:text-amber-300 lg:hidden"
          >
            {{ t("appName") }}
          </p>
          <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {{ t("login") }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">
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
