
require("dotenv").config({
  path: require("node:path").join(__dirname, "../.env")
});

const {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage
} = require("electron");

const path = require("node:path");
const fs = require("node:fs/promises");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase credentials are missing. Check your root .env file.");
}

// Store the Supabase session encrypted on this computer.
const sessionFile = () =>
  path.join(app.getPath("userData"), "supabase-session.enc");

const secureSessionStorage = {
  async getItem(key) {
    if (key !== "spendwise-auth-token") return null;

    try {
      const encrypted = await fs.readFile(sessionFile());
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("Secure storage is unavailable on this computer.");
      }
      return safeStorage.decryptString(encrypted);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  },

  async setItem(key, value) {
    if (key !== "spendwise-auth-token") return;

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Secure storage is unavailable on this computer.");
    }

    const encrypted = safeStorage.encryptString(value);
    await fs.writeFile(sessionFile(), encrypted, { mode: 0o600 });
  },

  async removeItem(key) {
    if (key !== "spendwise-auth-token") return;

    try {
      await fs.unlink(sessionFile());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
};

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: secureSessionStorage,
    storageKey: "spendwise-auth-token",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 850,
    minHeight: 600,
    title: "SpendWise",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

// Return the authenticated user's current account.
ipcMain.handle("auth:current-user", async () => {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { success: false, user: null };
  }

  return {
    success: true,
    user: { id: data.user.id, email: data.user.email }
  };
});

// Register a new account.
ipcMain.handle("auth:register", async (_event, { email, password }) => {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password
  });

  if (error) return { success: false, message: error.message };

  return {
    success: true,
    user: data.session
      ? { id: data.user.id, email: data.user.email }
      : null,
    message: data.session
      ? "Registration successful!"
      : "Check your email to confirm your account before logging in."
  };
});

// Log in and persist the session.
ipcMain.handle("auth:login", async (_event, { email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error) return { success: false, message: error.message };

  return {
    success: true,
    user: { id: data.user.id, email: data.user.email }
  };
});

ipcMain.handle("auth:logout", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) return { success: false, message: error.message };
  return { success: true };
});

// Fetch only the signed-in user's expenses. RLS enforces ownership.
ipcMain.handle("expenses:read", async () => {
  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Please log in to view your expenses.");
  }

  const { data, error } = await supabase
    .from("expenses")
    .select("id, title, amount, category, transaction_type, expense_date")
    .eq("user_id", userData.user.id)
    .order("expense_date", { ascending: false });

  if (error) throw new Error(error.message);

  return data.map((item) => ({
    id: item.id,
    title: item.title,
    amount: Number(item.amount),
    category: item.category,
    date: item.expense_date
  }));
});

// Save the supplied expense list to the signed-in user's cloud account.
ipcMain.handle("expenses:save", async (_event, expenses) => {
  if (!Array.isArray(expenses)) {
    throw new Error("Expenses must be an array.");
  }

  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Please log in before saving expenses.");
  }

  if (expenses.length === 0) return [];

  const userId = userData.user.id;

  const rows = expenses.map((item) => {
    const isIncome = item.category === "Income";

    return {
      id: item.id,
      user_id: userId,
      title: String(item.title).trim(),
      amount: Number(item.amount),
      category: item.category,
      transaction_type: isIncome ? "income" : "expense",
      expense_date: item.date
    };
  });

  const { error } = await supabase
    .from("expenses")
    .upsert(rows, { onConflict: "id" });

  if (error) throw new Error(error.message);

  return { success: true };
});

// Diagnostic check: requires a logged-in user.
ipcMain.handle("supabase:test", async () => {
  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    return {
      success: false,
      message: "Please log in before testing the database."
    };
  }

  const { error } = await supabase
    .from("expenses")
    .select("id")
    .eq("user_id", userData.user.id)
    .limit(1);

  if (error) return { success: false, message: error.message };

  return { success: true, message: "Authenticated Supabase connection successful!" };
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
  if (process.platform !== "darwin") app.quit();
});
