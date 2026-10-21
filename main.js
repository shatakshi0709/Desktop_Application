
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { readExpenses, saveExpenses } = require("./src/utils/storage");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 850,
    minHeight: 600,
    title: "Expense Tracker",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile("index.html");
}

ipcMain.handle("expenses:read", async () => {
  return await readExpenses();
});

ipcMain.handle("expenses:save", async (_event, expenses) => {
  if (!Array.isArray(expenses)) {
    throw new Error("Expenses must be an array.");
  }

  return await saveExpenses(expenses);
});

app.whenReady().then(() => {
  createWindow();

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
