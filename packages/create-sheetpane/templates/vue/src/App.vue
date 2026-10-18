<script setup lang="ts">
// Registers <sheetpane-excel> and <sheetpane-errors>; vite.config.ts tells Vue they are custom elements.
import '@sheetpane/grid';
import { ref } from 'vue';

const popup = ref(false);
const open = ref(0);
</script>

<template>
  <header class="bar">
    <strong>__SHEETPANE_NAME__</strong>
    <span class="count">{{ open === 0 ? 'no open errors' : `${open} open error${open === 1 ? '' : 's'}` }}</span>
    <button type="button" @click="popup = true">Open in a pop-up</button>
  </header>
  <!-- One pane, three places: the sheet and its errors side by side, and the same sheet in a pop-up. -->
  <main class="review">
    <sheetpane-excel pane="review" mode="edit" author="You" src="/showcase.xlsx" rules-src="/showcase.rules.json" />
    <sheetpane-errors pane="review" author="You"
      @sheetpane-errors="(e) => (open = e.detail.errors.filter((x) => x.status === 'open').length)" />
  </main>
  <sheetpane-excel pane="review" mode="edit" author="You" display="popup" :open.prop="popup" @sheetpane-close="popup = false" />
</template>
