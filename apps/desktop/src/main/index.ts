import { join } from "node:path";
import { BrowserWindow, app, shell } from "electron";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js")
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  // 禁止 window.open 脱离应用,外链交给系统浏览器。
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // electron-vite dev 注入渲染层 dev server 地址;生产加载 out/renderer 构建产物。
  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  // macOS:关闭全部窗口后点 Dock 图标重新创建窗口。
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
