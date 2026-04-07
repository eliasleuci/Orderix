import { app, BrowserWindow } from 'electron';
import * as path from 'path';

function createWindow() {
  const isDev = !app.isPackaged;
  
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'Orderix',
    icon: path.join(__dirname, isDev ? '../public/icono.ico' : '../dist/icono.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    // En producción, el path es relativo a la ubicación del main.cjs en dist-electron/
    const indexPath = path.join(__dirname, '../dist/index.html');
    win.loadFile(indexPath);
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
