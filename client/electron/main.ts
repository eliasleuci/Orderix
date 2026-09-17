import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  let updateReady = false;

  autoUpdater.on('update-downloaded', async () => {
    updateReady = true;
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Actualización disponible',
      message: 'Hay una nueva versión de Orderix lista. ¿Reiniciar ahora para instalarla?',
      detail: 'Si elegís "Más tarde", se instalará sola la próxima vez que cierres el programa.',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  app.on('before-quit', () => {
    if (updateReady) {
      updateReady = false;
      autoUpdater.quitAndInstall(true, true);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Error buscando actualizaciones:', err);
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('No se pudo chequear actualizaciones:', err);
  });
}

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

app.whenReady().then(() => {
  createWindow();
  if (app.isPackaged) setupAutoUpdater();
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
