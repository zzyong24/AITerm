import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5001',
    headless: true,
    viewport: { width: 1280, height: 720 }
  },
  // 运行测试前启动后端服务器
  webServer: {
    command: 'node server/index.mjs',
    url: 'http://localhost:5001/api/state',
    reuseExistingServer: true,
    timeout: 15000
  }
})
