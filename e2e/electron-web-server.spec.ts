import { test, expect, request } from '@playwright/test'

/**
 * Electron 内嵌 Web 服务器测试
 *
 * 此测试仅在 Electron 打包版本运行时有意义（端口 5003）。
 * 开发环境下请先启动 Electron 应用后再执行此测试。
 */
test.describe('Electron 内嵌 Web 服务器', () => {
  test('AC-01: Electron 打包后 HTTP 服务器监听', async ({ page }) => {
    // 检查端口是否可用，否则跳过（开发环境中 Electron 未启动时）
    const ctx = await request.newContext()
    const reachable = await ctx.get('http://localhost:5003', { timeout: 3000 }).then(() => true).catch(() => false)
    await ctx.dispose()
    if (!reachable) {
      test.skip(true, 'Port 5003 not reachable — Electron app not running, skipping')
      return
    }

    // 启动 Electron 后等待服务器就绪
    await page.goto('http://localhost:5003')
    await page.waitForLoadState('domcontentloaded')

    // 验证返回 Vue app HTML
    const content = await page.content()
    expect(content).toContain('AITerm')
  })
})