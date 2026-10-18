import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// The sheetpane-* tags are custom elements, not Vue components.
export default defineConfig({
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('sheetpane-') } } })],
});
