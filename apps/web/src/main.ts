import "./styles.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { i18n } from "./i18n";
import { useThemeStore } from "./stores/theme";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia).use(router).use(i18n);
useThemeStore().init();
app.mount("#app");
