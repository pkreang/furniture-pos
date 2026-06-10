<script setup lang="ts">
import { ref, computed, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: string[];
    placeholder?: string;
    disabled?: boolean;
  }>(),
  { placeholder: "", disabled: false },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const highlighted = ref(-1);

// The dropdown filters options by what's typed, but free text is always
// allowed — typing a value not in `options` still updates the model.
const filtered = computed(() => {
  const q = props.modelValue.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter((o) => o.toLowerCase().includes(q));
});

function onInput(e: Event): void {
  emit("update:modelValue", (e.target as HTMLInputElement).value);
  open.value = true;
  highlighted.value = -1;
}

function pick(value: string): void {
  emit("update:modelValue", value);
  open.value = false;
  highlighted.value = -1;
}

function onKeydown(e: KeyboardEvent): void {
  if (!open.value && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    open.value = true;
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    highlighted.value = Math.min(highlighted.value + 1, filtered.value.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    highlighted.value = Math.max(highlighted.value - 1, 0);
  } else if (e.key === "Enter" && highlighted.value >= 0) {
    e.preventDefault();
    pick(filtered.value[highlighted.value]);
  } else if (e.key === "Escape") {
    open.value = false;
  }
}

function onBlur(): void {
  // Delay so a click on an option registers before the list closes.
  setTimeout(() => {
    open.value = false;
    highlighted.value = -1;
  }, 120);
}

watch(
  () => props.options,
  () => {
    highlighted.value = -1;
  },
);
</script>

<template>
  <div ref="root" class="relative">
    <input
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="input"
      autocomplete="off"
      @input="onInput"
      @focus="open = true"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <ul
      v-if="open && filtered.length"
      class="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
    >
      <li
        v-for="(opt, i) in filtered"
        :key="opt"
        :class="[
          'px-3 py-2 text-sm cursor-pointer',
          i === highlighted
            ? 'bg-indigo-600 text-white'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
        ]"
        @mousedown.prevent="pick(opt)"
        @mouseenter="highlighted = i"
      >
        {{ opt }}
      </li>
    </ul>
  </div>
</template>
