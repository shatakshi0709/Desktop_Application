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
const crypto = require("node:crypto");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase credentials are missing. Check your root .env file.");
}

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

function friendlyError(error, fallback) {
  const message = error?.message || String(error || "");

  if (/fetch|network|ENOTFOUND|ECONN|Failed to fetch|timed out/i.test(message)) {
    return "Network error. Check your internet connection and try again.";
  }

  return message || fallback || "Something went wrong. Please try again.";
}

function publicUser(user) {
  return { id: user.id, email: user.email };
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Please log in first.");
  }

  return data.user;
}

function mapExpenseRow(item) {
  return {
    id: item.id,
    title: item.title,
    amount: Number(item.amount),
    category: item.category,
    date: item.expense_date,
    transactionType: item.transaction_type
  };
}

function expenseRowFromClient(item, userId) {
  const title = String(item.title || "").trim();
  const amount = Number(item.amount);
  const category = String(item.category || "").trim();
  const date = String(item.date || "").trim();
  const isIncome = category === "Income";

  if (!title || title.length > 60) {
    throw new Error("Please enter a title of up to 60 characters.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Please enter a valid amount greater than zero.");
  }

  if (!category) {
    throw new Error("Please choose a category.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Please choose a valid date.");
  }

  return {
    id: item.id,
    user_id: userId,
    title,
    amount,
    category,
    transaction_type: isIncome ? "income" : "expense",
    expense_date: date
  };
}

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
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("auth:current-user", async () => {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { success: false, user: null };
    }

    return {
      success: true,
      user: publicUser(data.user)
    };
  } catch (error) {
    return {
      success: false,
      user: null,
      message: friendlyError(error, "Could not restore your session.")
    };
  }
});

ipcMain.handle("auth:register", async (_event, credentials = {}) => {
  try {
    const email = String(credentials.email || "").trim();
    const password = String(credentials.password || "");

    if (!email || !password) {
      return { success: false, message: "Email and password are required." };
    }

    if (password.length < 6) {
      return { success: false, message: "Password must be at least 6 characters." };
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return { success: false, message: error.message };

    return {
      success: true,
      user: data.session ? publicUser(data.user) : null,
      message: data.session
        ? "Registration successful!"
        : "Check your email to confirm your account before logging in."
    };
  } catch (error) {
    return {
      success: false,
      message: friendlyError(error, "Registration failed.")
    };
  }
});

ipcMain.handle("auth:login", async (_event, credentials = {}) => {
  try {
    const email = String(credentials.email || "").trim();
    const password = String(credentials.password || "");

    if (!email || !password) {
      return { success: false, message: "Email and password are required." };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) return { success: false, message: error.message };

    return {
      success: true,
      user: publicUser(data.user)
    };
  } catch (error) {
    return {
      success: false,
      message: friendlyError(error, "Login failed.")
    };
  }
});

ipcMain.handle("auth:logout", async () => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: friendlyError(error, "Logout failed.")
    };
  }
});

ipcMain.handle("expenses:read", async () => {
  try {
    const user = await requireUser();

    const { data, error } = await supabase
      .from("expenses")
      .select("id, title, amount, category, transaction_type, expense_date")
      .eq("user_id", user.id)
      .order("expense_date", { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(mapExpenseRow);
  } catch (error) {
    throw new Error(friendlyError(error, "Could not load your expenses."));
  }
});

ipcMain.handle("expenses:save", async (_event, expenses) => {
  try {
    if (!Array.isArray(expenses)) {
      throw new Error("Expenses must be an array.");
    }

    const user = await requireUser();

    if (expenses.length === 0) return { success: true };

    const rows = expenses.map((item) => expenseRowFromClient(item, user.id));

    const { error } = await supabase
      .from("expenses")
      .upsert(rows, { onConflict: "id" });

    if (error) throw new Error(error.message);

    return { success: true };
  } catch (error) {
    throw new Error(friendlyError(error, "Could not save expenses."));
  }
});

ipcMain.handle("expenses:add", async (_event, expense) => {
  try {
    const user = await requireUser();
    const row = expenseRowFromClient(expense, user.id);

    const { data, error } = await supabase
      .from("expenses")
      .insert(row)
      .select("id, title, amount, category, transaction_type, expense_date")
      .single();

    if (error) throw new Error(error.message);

    return mapExpenseRow(data);
  } catch (error) {
    throw new Error(friendlyError(error, "Could not add this transaction."));
  }
});

ipcMain.handle("expenses:delete", async (_event, id) => {
  try {
    const user = await requireUser();

    if (!id) throw new Error("Missing transaction id.");

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    return { success: true };
  } catch (error) {
    throw new Error(friendlyError(error, "Could not delete this transaction."));
  }
});

ipcMain.handle("profile:get", async () => {
  try {
    const user = await requireUser();

    const { data, error } = await supabase
      .from("profiles")
      .select("opening_balance, monthly_income")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return {
      exists: Boolean(data),
      openingBalance: Number(data?.opening_balance ?? 0),
      monthlyIncome: Number(data?.monthly_income ?? 0)
    };
  } catch (error) {
    throw new Error(friendlyError(error, "Could not load your profile."));
  }
});

ipcMain.handle("profile:save", async (_event, profile = {}) => {
  try {
    const user = await requireUser();
    const openingBalance = Number(profile.openingBalance);
    const monthlyIncome = Number(profile.monthlyIncome);

    if (
      !Number.isFinite(openingBalance) ||
      !Number.isFinite(monthlyIncome) ||
      openingBalance < 0 ||
      monthlyIncome < 0
    ) {
      throw new Error("Please enter valid, non-negative amounts.");
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          opening_balance: openingBalance,
          monthly_income: monthlyIncome
        },
        { onConflict: "user_id" }
      );

    if (error) throw new Error(error.message);

    return { success: true };
  } catch (error) {
    throw new Error(friendlyError(error, "Could not save your profile."));
  }
});



ipcMain.handle("salary:ensure-current-month", async () => {
  try {
    const user = await requireUser();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("monthly_income")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Please complete your financial setup first.");

    const amount = Number(profile.monthly_income);

    // Zero income means there is no salary transaction to create.
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: true, created: false };
    }

    const now = new Date();
    const month = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0")
    ].join("-");

    // Stable UUID for this user and month.
    const hash = crypto
      .createHash("sha256")
      .update(`spendwise-salary:${user.id}:${month}`)
      .digest("hex");

    const id = [
      hash.slice(0, 8),
      hash.slice(8, 12),
      `4${hash.slice(13, 16)}`,
      `${((parseInt(hash.slice(16, 17), 16) & 3) | 8).toString(16)}${hash.slice(17, 20)}`,
      hash.slice(20, 32)
    ].join("-");

    const { error } = await supabase
      .from("expenses")
      .upsert(
        {
          id,
          user_id: user.id,
          title: `Salary - ${month}`,
          amount,
          category: "Income",
          transaction_type: "income",
          expense_date: `${month}-01`
        },
        { onConflict: "id", ignoreDuplicates: true }
      );

    if (error) throw new Error(error.message);

    return { success: true, created: true };
  } catch (error) {
    throw new Error(
      friendlyError(error, "Could not create this month's salary.")
    );
  }
});


ipcMain.handle("supabase:test", async () => {
  try {
    const user = await requireUser();

    const { error } = await supabase
      .from("expenses")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (error) return { success: false, message: error.message };

    return {
      success: true,
      message: "Authenticated Supabase connection successful!"
    };
  } catch (error) {
    return {
      success: false,
      message: friendlyError(error, "Please log in before testing the database.")
    };
  }
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
