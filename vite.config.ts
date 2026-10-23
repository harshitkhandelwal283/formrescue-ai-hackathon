import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['3000-igajt0w9qnx1yefm3unjl-74380fcf.sg2.manus.computer'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.ts',
    css: true,
    clearMocks: true,
  },
});
