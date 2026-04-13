import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
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
    port: 5173
  }
})
