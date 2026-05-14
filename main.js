/* global process */
/* eslint-env node */
import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    title: "AgroControl Porcino",
    autoHideMenuBar: true, 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      spellcheck: false
    }
  });

  // MENU DE SISTEMA: Necesario para atajos de teclado (Copiar/Pegar)
  const template = [
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'toggledevtools', label: 'Herramientas de desarrollador' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // FOCO DINÁMICO: Asegura que el teclado siempre esté conectado al contenido
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    setTimeout(() => { if (win.webContents) win.webContents.focus(); }, 400);
  });

  // Si la ventana recupera el foco (al volver de otra app), forzamos el teclado
  win.on('focus', () => {
    if (win.webContents) win.webContents.focus();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});