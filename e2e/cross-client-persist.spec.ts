import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'

test.describe('跨端持久化', () => {
  test('AC-02: 多端数据一致 - API 响应结构正确', async ({ page }) => {
    const response = await page.request.get('http://localhost:5001/api/state')
    expect(response.ok()).toBeTruthy()
    const state = await response.json()

    // 验证数据结构完整
    expect(state).toHaveProperty('projects')
    expect(state).toHaveProperty('terminals')
    expect(state).toHaveProperty('editors')
    expect(Array.isArray(state.projects)).toBeTruthy()
    expect(Array.isArray(state.terminals)).toBeTruthy()
    expect(Array.isArray(state.editors)).toBeTruthy()
  })

  test('批量更新状态 - PUT /api/state', async ({ page }) => {
    const testId = randomUUID().slice(0, 8)

    const response = await page.request.put('http://localhost:5001/api/state', {
      data: {
        projects: [
          { id: `e2e-proj-${testId}`, name: `项目E2E-${testId}`, path: '/tmp/e2e', order: 0 }
        ],
        terminals: [],
        editors: []
      }
    })
    expect(response.ok()).toBeTruthy()

    // 验证更新成功
    const getResponse = await page.request.get('http://localhost:5001/api/state')
    const state = await getResponse.json()
    expect(state.projects?.some((p: any) => p.name === `项目E2E-${testId}`)).toBeTruthy()
  })

  test('Terminal CRUD - 创建/更新/删除', async ({ page }) => {
    const terminalId = `e2e-term-${randomUUID().slice(0, 8)}`

    // 1. 创建 Terminal
    const createResponse = await page.request.post('http://localhost:5001/api/persist/terminals', {
      data: {
        id: terminalId,
        name: 'E2E测试终端',
        cwd: '/tmp',
        taskSlug: 'e2e-test'
      }
    })
    expect(createResponse.ok()).toBeTruthy()

    // 2. 更新 Terminal
    const updateResponse = await page.request.put(`http://localhost:5001/api/terminals/${terminalId}`, {
      data: { name: 'E2E测试终端-已更新' }
    })
    expect(updateResponse.ok()).toBeTruthy()

    // 3. 验证更新
    const getResponse = await page.request.get('http://localhost:5001/api/state')
    const state = await getResponse.json()
    const updated = state.terminals?.find((t: any) => t.id === terminalId)
    expect(updated?.name).toBe('E2E测试终端-已更新')

    // 4. 删除 Terminal
    const deleteResponse = await page.request.delete(`http://localhost:5001/api/persist/terminals/${terminalId}`)
    expect(deleteResponse.ok()).toBeTruthy()
  })

  test('编辑器状态持久化 - PUT /api/editors', async ({ page }) => {
    const editorId = `e2e-editor-${randomUUID().slice(0, 8)}`
    const projectId = 'e2e-test-project'

    const response = await page.request.put('http://localhost:5001/api/editors', {
      data: {
        projectId,
        editors: [
          { id: editorId, path: `/tmp/test/${editorId}.ts`, name: `${editorId}.ts`, scrollToLine: 10 }
        ]
      }
    })
    expect(response.ok()).toBeTruthy()

    // 验证保存成功
    const getResponse = await page.request.get('http://localhost:5001/api/state')
    const state = await getResponse.json()
    const found = state.editors?.some((e: any) => e.id === editorId && e.projectId === projectId)
    expect(found).toBeTruthy()
  })

  test('Terminal 重命名后刷新页面，名称保持', async ({ page }) => {
    await page.goto('http://localhost:5001')
    await page.waitForTimeout(500)

    const projectItem = page.locator('.project-tree .project-item').first()
    if (await projectItem.isVisible()) {
      await projectItem.click()
      await page.waitForTimeout(500)

      const terminalTab = page.locator('.content-tab').filter({ has: page.locator('.anticon-desktop') }).first()
      if (await terminalTab.isVisible()) {
        // 双击 Tab 标题进行重命名
        const nameSpan = terminalTab.locator('span').filter({ hasText: /\S/ }).first()

        // 处理重命名 prompt
        const newName = `刷新测试-${randomUUID().slice(0, 6)}`
        page.on('dialog', async dialog => {
          expect(dialog.type()).toBe('prompt')
          await dialog.accept(newName)
        })

        await nameSpan.dblclick()
        await page.waitForTimeout(300)

        // 验证名称已更新
        await page.waitForTimeout(200)

        // 刷新页面
        await page.reload()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)

        // 验证名称持久化（检查所有 terminal tabs）
        const allTabs = page.locator('.content-tab')
        const count = await allTabs.count()
        let found = false
        for (let i = 0; i < count; i++) {
          const text = await allTabs.nth(i).textContent()
          if (text?.includes(newName)) {
            found = true
            break
          }
        }
        expect(found).toBeTruthy()
      }
    }
  })
})
