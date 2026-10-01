import { app, BrowserWindow, Menu, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initDb } from './db'
import { registerIpc } from './ipc'
import { getPhoneStatus, syncPhoneRuntime, updatePhone } from './phone'
import { registerPhoneApi } from './server'
import { runSmoke } from './smoke'

const isDev = !app.isPackaged
const isSmoke = process.env.FINANCE_SMOKE === '1'

if (isSmoke) {
  const dir = join(tmpdir(), 'finance-smoke')
  mkdirSync(dir, { recursive: true })
  app.setPath('userData', dir)
}

if (isDev && !isSmoke) {
  app.commandLine.appendSwitch('remote-debugging-port', '9229')
}

function createMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Finance',
    backgroundColor: '#f3eee6',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('Failed to load', code, desc, url)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setName('Finance')

void app.whenReady().then(async () => {
  initDb()
  registerPhoneApi({ status: getPhoneStatus, update: updatePhone })
  registerIpc()
  if (!isSmoke) syncPhoneRuntime()
  if (isSmoke) {
    try {
      await runSmoke()
      app.exit(0)
    } catch (err) {
      console.error('SMOKE_FAIL', err)
      app.exit(1)
    }
    return
  }
  createMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
