import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app uses @sheetpane/grid's public exports only (its dist/ build), as a host would.
export default defineConfig({ plugins: [react()], server: { port: 5174 }, preview: { port: 5174 } });
