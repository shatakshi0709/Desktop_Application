
require("dotenv").config({
  path: require("node:path").join(__dirname, "../.env")
});

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const { readExpenses, saveExpenses } = require("../src/utils/storage");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase credentials are missing. Check your root .env file.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
  })
  ;

  win.loadFile(path.join(__dirname, "index.html"));
  win.webContents.openDevTools();
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

// Temporary connection test; does not modify your database.
ipcMain.handle("supabase:test", async () => {
  const { error } = await supabase
    .from("expenses")
    .select("id")
    .limit(1);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Supabase connection successful!" };
});


ipcMain.handle("auth:register", async (_event, { email, password }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return {
    success: true,
    message: data.session
      ? "Registration successful!"
      : "Registration successful! Please check your email to confirm your account."
  };
});

ipcMain.handle("auth:login", async (_event, { email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return {
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email
    }
  };
});

ipcMain.handle("auth:logout", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true };
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

