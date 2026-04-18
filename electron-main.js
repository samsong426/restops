const { app, BrowserWindow, dialog } = require('electron');
const http = require('http');
const path = require('path');
const { fork } = require('child_process');

const PORT = Number(process.env.PORT || 3001);
const HOST = '127.0.0.1';
const START_URL = `http://${HOST}:${PORT}`;

let mainWindow;
let serverProcess;
let isQuitting = false;

function waitForServer(url, attempts = 40) {
  return new Promise((resolve, reject) => {
    const tryConnect = (remaining) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (remaining <= 0) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(() => tryConnect(remaining - 1), 250);
      });
    };

    tryConnect(attempts);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    title: 'RestOps',
    backgroundColor: '#f6f1e5',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startServerAndLoadUI() {
  const userDataDir = app.getPath('userData');
  serverProcess = fork(path.join(__dirname, 'server.js'), {
    env: {
      ...process.env,
      HOST,
      PORT: String(PORT),
      APP_DATA_DIR: userDataDir,
    },
    stdio: 'inherit',
  });

  serverProcess.on('exit', (code, signal) => {
    serverProcess = null;
    if (isQuitting) {
      return;
    }

    const detail = code != null
      ? `The local server stopped with exit code ${code}.`
      : `The local server was terminated by signal ${signal}.`;

    dialog.showErrorBox('RestOps stopped', detail);
    if (mainWindow) {
      mainWindow.close();
    }
  });

  await waitForServer(START_URL);
  await mainWindow.loadURL(START_URL);
}

app.whenReady().then(async () => {
  createWindow();

  try {
    await startServerAndLoadUI();
  } catch (error) {
    dialog.showErrorBox('RestOps could not start', error.message);
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    mainWindow.loadURL(START_URL).catch(() => {});
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
