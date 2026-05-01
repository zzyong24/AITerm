import { test, expect } from '@playwright/test'

test.describe('Electron 内嵌 Web 服务器', () => {
  test('AC-01: Electron 打包后 HTTP 服务器监听', async ({ page }) => {
    // 启动 Electron 后等待服务器就绪
    await page.goto('http://localhost:5003')
    await page.waitForLoadState('domcontentloaded')

    // 验证返回 Vue app HTML
    const content = await page.content()
    expect(content).toContain('AITerm')
  })
})