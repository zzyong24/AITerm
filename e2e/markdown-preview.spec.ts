import { test, expect } from '@playwright/test'

test.describe('Markdown Preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
  })

  test('预览切换按钮在 markdown 文件时可见', async ({ page }) => {
    // Click on test file in sidebar
    const testFile = page.locator('text=test-preview.md')
    if (await testFile.isVisible()) {
      await testFile.click()
      await page.waitForTimeout(500)

      // Find preview button (eye icon)
      const previewBtn = page.locator('.toolbar-btn').filter({ has: page.locator('svg') }).nth(3)
      await expect(previewBtn).toBeVisible()
    }
  })

  test('mermaid 图表正确渲染为 SVG', async ({ page }) => {
    const testFile = page.locator('text=test-preview.md')
    if (await testFile.isVisible()) {
      await testFile.click()
      await page.waitForTimeout(500)

      // Click preview button
      const previewBtn = page.locator('.toolbar-btn').filter({ has: page.locator('svg') }).nth(3)
      await previewBtn.click()
      await page.waitForTimeout(1000)

      // Check that mermaid div has SVG content, not [object Object]
      const mermaidDiv = page.locator('.mermaid').first()
      await expect(mermaidDiv).toBeVisible()

      const svg = mermaidDiv.locator('svg')
      await expect(svg).toBeVisible()

      // Should not show [object Object]
      const textContent = await mermaidDiv.textContent()
      expect(textContent).not.toContain('[object Object]')
    }
  })
})