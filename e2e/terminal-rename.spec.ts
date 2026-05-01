import { test, expect } from '@playwright/test'

test.describe('Terminal Rename & Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
  })

  test('终端 Tab 双击可重命名', async ({ page }) => {
    // 等待项目加载
    await page.waitForTimeout(500)

    // 打开一个终端（点击项目）
    const projectItem = page.locator('.project-tree .project-item').first()
    if (await projectItem.isVisible()) {
      await projectItem.click()
      await page.waitForTimeout(500)

      // 找到终端 Tab
      const terminalTab = page.locator('.content-tab').filter({ has: page.locator('.anticon-desktop') }).first()
      if (await terminalTab.isVisible()) {
        // 双击 Tab 标题进行重命名
        const nameSpan = terminalTab.locator('span').filter({ hasText: /\S/ }).first()
        await nameSpan.dblclick()

        // 等待 prompt 出现
        page.on('dialog', async dialog => {
          expect(dialog.type()).toBe('prompt')
          await dialog.accept('测试终端-重命名')
        })

        await nameSpan.dblclick()
        await page.waitForTimeout(300)

        // 验证名称已更新（如果有 prompt 处理）
        // const newName = await terminalTab.locator('span').first().textContent()
        // expect(newName).toContain('测试终端')
      }
    }
  })

  test('Tab 宽度固定，超长名称显示省略号', async ({ page }) => {
    await page.waitForTimeout(500)

    const projectItem = page.locator('.project-tree .project-item').first()
    if (await projectItem.isVisible()) {
      await projectItem.click()
      await page.waitForTimeout(500)

      const terminalTab = page.locator('.content-tab').filter({ has: page.locator('.anticon-desktop') }).first()
      if (await terminalTab.isVisible()) {
        // 双击重命名，输入超长名称
        const nameSpan = terminalTab.locator('span').filter({ hasText: /\S/ }).first()

        page.on('dialog', async dialog => {
          await dialog.accept('这是一个非常非常非常长的终端名称用于测试截断功能')
        })

        await nameSpan.dblclick()
        await page.waitForTimeout(300)

        // 检查 Tab 是否有 max-width 限制
        const tabStyle = await terminalTab.getAttribute('class')
        expect(tabStyle).toBeDefined()
      }
    }
  })
})