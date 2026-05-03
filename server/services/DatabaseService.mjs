import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'

export class DatabaseService {
  constructor() {
    // 数据库路径：~/.aiterm/aiterm.db
    const dbDir = join(homedir(), '.aiterm')
    this.dbPath = join(dbDir, 'aiterm.db')

    // 确保目录存在
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }

    // 初始化数据库
    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initTables()

    console.log(`[DatabaseService] Initialized at ${this.dbPath}`)
  }

  /**
   * 初始化数据库表
   */
  initTables() {
    // projects 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        "order" INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now')),
        lastAccessedAt TEXT DEFAULT (datetime('now'))
      )
    `)

    // terminals 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS terminals (
        id TEXT PRIMARY KEY,
        projectId TEXT,
        name TEXT NOT NULL,
        cwd TEXT NOT NULL,
        taskSlug TEXT,
        history TEXT DEFAULT '[]',
        createdAt TEXT DEFAULT (datetime('now')),
        lastActiveAt TEXT DEFAULT (datetime('now'))
      )
    `)
    // 迁移：添加 projectId 列（如果不存在）
    try {
      this.db.exec("ALTER TABLE terminals ADD COLUMN projectId TEXT")
    } catch (e) {
      // 列已存在，忽略
    }

    // editors 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS editors (
        projectId TEXT NOT NULL,
        id TEXT NOT NULL,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        scrollToLine INTEGER,
        PRIMARY KEY (projectId, id)
      )
    `)

    // settings 表（用于全局设置）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `)

    console.log('[DatabaseService] Tables initialized')
  }

  // ============ Projects ============

  /**
   * getAllProjects 获取所有项目
   * @returns 项目数组
   */
  getAllProjects() {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY "order" ASC, lastAccessedAt DESC')
    return stmt.all()
  }

  /**
   * getProject 获取单个项目
   * @param id 项目 ID
   * @returns 项目或 undefined
   */
  getProject(id) {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?')
    return stmt.get(id)
  }

  /**
   * addProject 添加项目
   * @param id 项目 ID
   * @param name 项目名称
   * @param path 项目路径
   * @param order 排序顺序
   * @returns 新增的项目
   */
  addProject(id, name, path, order = 0) {
    const stmt = this.db.prepare(
      'INSERT INTO projects (id, name, path, "order", lastAccessedAt) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    )
    stmt.run(id, name, path, order)
    return this.getProject(id)
  }

  /**
   * updateProject 更新项目名称、路径和顺序
   * @param id 项目 ID
   * @param name 项目名称
   * @param path 项目路径
   * @param order 排序
   */
  updateProject(id, name, path, order = 0) {
    const stmt = this.db.prepare('UPDATE projects SET name = ?, path = ?, "order" = ? WHERE id = ?')
    stmt.run(name, path, order, id)
  }

  /**
   * removeProject 删除项目
   * @param id 项目 ID
   */
  removeProject(id) {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?')
    stmt.run(id)
  }

  /**
   * updateProjectLastAccessed 更新项目最后访问时间
   * @param id 项目 ID
   */
  updateProjectLastAccessed(id) {
    const stmt = this.db.prepare('UPDATE projects SET lastAccessedAt = datetime(\'now\') WHERE id = ?')
    stmt.run(id)
  }

  // ============ Terminals ============

  /**
   * getAllTerminals 获取所有终端
   * @returns 终端数组
   */
  getAllTerminals() {
    const stmt = this.db.prepare('SELECT * FROM terminals ORDER BY lastActiveAt DESC')
    const rows = stmt.all()
    return rows.map(row => ({
      ...row,
      history: JSON.parse(row.history || '[]')
    }))
  }

  /**
   * getTerminal 获取单个终端
   * @param id 终端 ID
   * @returns 终端或 undefined
   */
  getTerminal(id) {
    const stmt = this.db.prepare('SELECT * FROM terminals WHERE id = ?')
    const row = stmt.get(id)
    if (row) {
      row.history = JSON.parse(row.history || '[]')
    }
    return row
  }

  /**
   * addTerminal 添加终端
   * @param id 终端 ID
   * @param name 终端名称
   * @param cwd 工作目录
   * @param taskSlug 任务 slug（可选）
   * @param projectId 项目 ID（可选）
   * @returns 新增的终端
   */
  addTerminal(id, name, cwd, taskSlug = null, projectId = null) {
    const stmt = this.db.prepare(
      'INSERT INTO terminals (id, projectId, name, cwd, taskSlug, history, lastActiveAt) VALUES (?, ?, ?, ?, ?, \'[]\', datetime(\'now\'))'
    )
    stmt.run(id, projectId, name, cwd, taskSlug)
    return this.getTerminal(id)
  }

  /**
   * updateTerminal 更新终端
   * @param id 终端 ID
   * @param updates 更新字段（name, cwd, taskSlug, history）
   */
  updateTerminal(id, updates) {
    const setClauses = []
    const values = []

    if (updates.name !== undefined) {
      setClauses.push('name = ?')
      values.push(updates.name)
    }
    if (updates.cwd !== undefined) {
      setClauses.push('cwd = ?')
      values.push(updates.cwd)
    }
    if (updates.projectId !== undefined) {
      setClauses.push('projectId = ?')
      values.push(updates.projectId)
    }
    if (updates.taskSlug !== undefined) {
      setClauses.push('taskSlug = ?')
      values.push(updates.taskSlug)
    }
    if (updates.history !== undefined) {
      setClauses.push('history = ?')
      values.push(JSON.stringify(updates.history))
    }

    setClauses.push('lastActiveAt = datetime(\'now\')')
    values.push(id)

    const stmt = this.db.prepare(
      `UPDATE terminals SET ${setClauses.join(', ')} WHERE id = ?`
    )
    stmt.run(...values)
  }

  /**
   * removeTerminal 删除终端
   * @param id 终端 ID
   */
  removeTerminal(id) {
    const stmt = this.db.prepare('DELETE FROM terminals WHERE id = ?')
    stmt.run(id)
  }

  /**
   * deleteTerminalsByProject 删除项目下的所有终端（级联删除）
   * @param projectId 项目 ID
   */
  deleteTerminalsByProject(projectId) {
    const stmt = this.db.prepare('DELETE FROM terminals WHERE projectId = ?')
    stmt.run(projectId)
  }

  // ============ Editors ============

  /**
   * getAllEditors 获取所有编辑器
   * @returns 编辑器数组
   */
  getAllEditors() {
    const stmt = this.db.prepare('SELECT * FROM editors')
    return stmt.all()
  }

  /**
   * getEditorsByProject 获取项目的编辑器
   * @param projectId 项目 ID
   * @returns 编辑器数组
   */
  getEditorsByProject(projectId) {
    const stmt = this.db.prepare('SELECT * FROM editors WHERE projectId = ?')
    return stmt.all(projectId)
  }

  /**
   * saveEditor 保存编辑器（upsert）
   * @param projectId 项目 ID
   * @param id 编辑器 ID
   * @param path 文件路径
   * @param name 编辑器名称
   * @param scrollToLine 滚动位置（可选）
   */
  saveEditor(projectId, id, path, name, scrollToLine = null) {
    const stmt = this.db.prepare(`
      INSERT INTO editors (projectId, id, path, name, scrollToLine)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(projectId, id) DO UPDATE SET
        path = excluded.path,
        name = excluded.name,
        scrollToLine = excluded.scrollToLine
    `)
    stmt.run(projectId, id, path, name, scrollToLine)
  }

  /**
   * removeEditor 删除编辑器
   * @param projectId 项目 ID
   * @param id 编辑器 ID
   */
  removeEditor(projectId, id) {
    const stmt = this.db.prepare('DELETE FROM editors WHERE projectId = ? AND id = ?')
    stmt.run(projectId, id)
  }

  /**
   * clearEditors 清除项目的所有编辑器
   * @param projectId 项目 ID
   */
  clearEditors(projectId) {
    const stmt = this.db.prepare('DELETE FROM editors WHERE projectId = ?')
    stmt.run(projectId)
  }

  // ============ Settings ============

  /**
   * getSetting 获取设置
   * @param key 设置键
   * @returns 设置值或 undefined
   */
  getSetting(key) {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?')
    const row = stmt.get(key)
    return row?.value
  }

  /**
   * setSetting 设置值
   * @param key 设置键
   * @param value 设置值
   */
  setSetting(key, value) {
    const stmt = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?)\n      ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    stmt.run(key, value)
  }

  // ============ 完整状态 ============

  /**
   * getFullState 获取完整状态
   * @returns 包含 projects, terminals, editors 的对象
   */
  getFullState() {
    return {
      projects: this.getAllProjects(),
      terminals: this.getAllTerminals(),
      editors: this.getAllEditors()
    }
  }

  /**
   * close 关闭数据库连接
   */
  close() {
    this.db.close()
    console.log('[DatabaseService] Closed')
  }
}

// 导出单例
let dbInstance = null

export function getDatabaseService() {
  if (!dbInstance) {
    dbInstance = new DatabaseService()
  }
  return dbInstance
}