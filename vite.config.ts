import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    // Only pick up unit tests in tests/ — exclude e2e Playwright specs
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'node',
  },
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue'],
          'ant-vendor': ['ant-design-vue'],
          'xterm-vendor': ['@xterm/xterm', '@xterm/addon-fit']
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:5002',
        ws: true
      }
    }
  }
})
