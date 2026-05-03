import express from 'express'
import cors from 'cors'
import { PtyService } from './services/PtyService.mjs'
import { ProjectService } from './services/ProjectService.mjs'
import { FileService } from './services/FileService.mjs'
import { DatabaseService, getDatabaseService } from './services/DatabaseService.mjs'
import { GitService } from '../dist-electron/shared/services/GitService.js'
import { registerRoutes } from './routes.mjs'

const app = express()
const PORT = 5001

app.use(cors())

const ptyService = new PtyService()
const projectService = new ProjectService()
const fileService = new FileService()
const gitService = new GitService()
const dbService = getDatabaseService()

registerRoutes(app, { ptyService, projectService, fileService, gitService, dbService }, {
  port: PORT,
  enableWs: true
})

app.listen(PORT, () => {
  console.log(`AITerm backend server running on http://localhost:${PORT}`)
  console.log(`WebSocket server running on ws://localhost:${PORT + 1}`)
})