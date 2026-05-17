import { createI18n } from "vue-i18n";
import th from "./th";
import en from "./en";

export const i18n = createI18n({
  legacy: false,
  locale: "th",
  fallbackLocale: "en",
  messages: { th, en },
});
