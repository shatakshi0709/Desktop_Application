const categoryIcons = {
  Food: "🍔",
  Transport: "🚗",
  Shopping: "🛍️",
  Education: "📚",
  Bills: "🧾",
  Health: "💊",
  Other: "📌",
  Income: "💰"
};

const categoryLabels = {
  Food: "Food & Dining",
  Transport: "Transport",
  Shopping: "Shopping",
  Education: "Education",
  Bills: "Bills",
  Health: "Health",
  Other: "Other",
  Income: "Income"
};

const categoryColors = {
  Food: "#6c63ff",
  Transport: "#38b99b",
  Shopping: "#ffad66",
  Education: "#ed7895",
  Bills: "#7c8cff",
  Health: "#5bb8e8",
  Other: "#9aa0b8",
  Income: "#16a878"
};

const viewMeta = {
  dashboard: {
    title: "Dashboard",
    eyebrow: "YOUR FINANCES AT A GLANCE"
  },
  transactions: {
    title: "Transactions",
    eyebrow: "COMPLETE HISTORY"
  },
  reports: {
    title: "Reports",
    eyebrow: "SPENDING INSIGHTS"
  },
  settings: {
    title: "Settings",
    eyebrow: "YOUR ACCOUNT"
  }
};

let transactions = [];
let userProfile = { openingBalance: 0, monthlyIncome: 0 };
let currentUser = null;
let authMode = "login";

const $ = (selector) => document.querySelector(selector);

function todayISO() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2
  }).format(Number(amount) || 0);
}

function formatDate(dateString) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function isIncome(item) {
  return item.category === "Income" || item.transactionType === "income";
}

function friendlyClientError(error, fallback) {
  const message = error?.message || String(error || "");
  if (/fetch|network|ENOTFOUND|Failed to fetch/i.test(message)) {
    return "Network error. Check your internet connection and try again.";
  }
  return message || fallback;
}

function hideOverlays() {
  $("#bootScreen").classList.add("hidden");
  $("#landingPage").classList.remove("is-visible");
  $("#authScreen").classList.remove("is-visible");
  $("#setupScreen").classList.remove("is-visible");
  $("#appShell").classList.remove("is-visible");
}

function showLanding() {
  hideOverlays();
  $("#landingPage").classList.add("is-visible");
}

function showAuthScreen(mode = authMode) {
  hideOverlays();
  authMode = mode;
  $("#authSubmit").textContent = mode === "login" ? "Log In" : "Create Account";
  $("#toggleAuth").textContent =
    mode === "login"
      ? "New here? Create an account"
      : "Already registered? Log in";
  $("#authPassword").setAttribute(
    "autocomplete",
    mode === "login" ? "current-password" : "new-password"
  );
  $("#authMessage").textContent = "";
  $("#authScreen").classList.add("is-visible");
}

function showSetupScreen() {
  hideOverlays();
  $("#setupMessage").textContent = "";
  $("#setupScreen").classList.add("is-visible");
}

function showDashboard() {
  hideOverlays();
  $("#appShell").classList.add("is-visible");
  setView("dashboard");
}

function setView(name) {
  Object.keys(viewMeta).forEach((viewName) => {
    $(`#view-${viewName}`).classList.toggle("is-visible", viewName === name);
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === name);
  });

  const meta = viewMeta[name];
  $("#pageTitle").textContent = meta.title;
  $("#pageEyebrow").textContent = meta.eyebrow;
}

function updateUserChrome() {
  const email = currentUser?.email || "";
  const initial = email ? email.charAt(0).toUpperCase() : "S";
  $("#userAvatar").textContent = initial;
  $("#userEmailLabel").textContent = email;
  $("#workspaceEmail").textContent = email || "Signed in";
  $("#settingsEmail").textContent = email;
}

function totals() {
  const expenseTotal = transactions
    .filter((item) => !isIncome(item))
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const totalIncome = transactions
    .filter(isIncome)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const openingBalance = Number(userProfile.openingBalance) || 0;
  const balance = openingBalance + totalIncome - expenseTotal;

  return {
    expenseTotal,
    extraIncome: totalIncome,
    monthlyIncome: totalIncome,
    openingBalance,
    balance
  };
}


function monthKey(dateString) {
  return String(dateString || "").slice(0, 7);
}

function currentMonthKey() {
  return todayISO().slice(0, 7);
}

function updateSummary() {
  const { expenseTotal, extraIncome, monthlyIncome, balance } = totals();
  $("#incomeAmount").textContent = formatMoney(monthlyIncome);
  $("#expenseAmount").textContent = formatMoney(expenseTotal);
  $("#balanceAmount").textContent = formatMoney(balance);
  $("#incomeNote").textContent = extraIncome
    ? `${formatMoney(extraIncome)} extra income recorded in transactions`
    : "Set during your financial setup";
}

function renderChart() {
  const count = Number($("#chartPeriod").value);
  const now = new Date();
  const groups = [];


  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    groups.push({
      key,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      income: key === currentMonthKey() ? Number(userProfile.monthlyIncome) || 0 : 0,
      expense: 0
    });
  }

  transactions.forEach((item) => {
    const group = groups.find((entry) => entry.key === monthKey(item.date));
    if (!group) return;
    if (isIncome(item)) group.income += Number(item.amount);
    else group.expense += Number(item.amount);
  });

  const peak = Math.max(
    1,
    ...groups.map((group) => Math.max(group.income, group.expense))
  );

  $("#chartBars").replaceChildren(
    ...groups.map((group) => {
      const wrap = document.createElement("div");
      wrap.className = "bar-group";

      const incomeBar = document.createElement("div");
      incomeBar.className = "bar income-bar";
      incomeBar.style.height = `${Math.max(4, (group.income / peak) * 100)}%`;
      incomeBar.title = `Income ${formatMoney(group.income)}`;

      const expenseBar = document.createElement("div");
      expenseBar.className = "bar expense-bar";
      expenseBar.style.height = `${Math.max(4, (group.expense / peak) * 100)}%`;
      expenseBar.title = `Expenses ${formatMoney(group.expense)}`;

      wrap.append(incomeBar, expenseBar);
      return wrap;
    })
  );

  $("#chartMonths").replaceChildren(
    ...groups.map((group) => {
      const label = document.createElement("span");
      label.textContent = group.label;
      return label;
    })
  );
}

function renderCategoryList(target, items, emptyText) {
  const container = $(target);
  container.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "card-note";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  const maxAmount = Math.max(...items.map((item) => item.amount), 1);

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "category";

    const top = document.createElement("div");
    top.className = "category-top";

    const name = document.createElement("span");
    name.textContent = `${categoryIcons[item.category] || "📌"} ${categoryLabels[item.category] || item.category}`;

    const amount = document.createElement("span");
    amount.textContent = formatMoney(item.amount);

    top.append(name, amount);

    const progress = document.createElement("div");
    progress.className = "progress";
    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = `${Math.max(4, (item.amount / maxAmount) * 100)}%`;
    fill.style.background = categoryColors[item.category] || "#6c63ff";
    progress.append(fill);

    row.append(top, progress);
    container.append(row);
  });
}

function categoryTotals(filterFn) {
  const totalsByCategory = {};

  transactions.filter(filterFn).forEach((item) => {
    totalsByCategory[item.category] =
      (totalsByCategory[item.category] || 0) + Number(item.amount);
  });

  return Object.entries(totalsByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function renderCategories() {
  const thisMonth = currentMonthKey();
  const monthExpenses = transactions.filter(
    (item) => !isIncome(item) && monthKey(item.date) === thisMonth
  );
  const monthTotal = monthExpenses.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  );

  $("#monthlySpending").innerHTML = `${formatMoney(monthTotal)} <small>this month</small>`;
  renderCategoryList(
    "#categoryList",
    categoryTotals((item) => !isIncome(item) && monthKey(item.date) === thisMonth),
    "No expenses recorded this month."
  );
}

function renderReports() {
  const { expenseTotal, extraIncome, monthlyIncome, balance } = totals();
  const thisMonth = currentMonthKey();
  const monthTotal = transactions
    .filter((item) => !isIncome(item) && monthKey(item.date) === thisMonth)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  $("#reportBalance").textContent = formatMoney(balance);
  $("#reportIncome").textContent = formatMoney(monthlyIncome);
  $("#reportExtraIncome").textContent = formatMoney(extraIncome);
  $("#reportExpenses").textContent = formatMoney(expenseTotal);
  $("#reportMonthSpend").textContent = formatMoney(monthTotal);

  renderCategoryList(
    "#reportCategoryList",
    categoryTotals((item) => !isIncome(item)),
    "No expenses recorded yet."
  );
}

function fillSettings() {
  $("#settingsOpeningBalance").value = userProfile.openingBalance;
  $("#settingsMonthlyIncome").value = userProfile.monthlyIncome;
}

function createTransactionRow(item, { showDelete = false } = {}) {
  const income = isIncome(item);
  const row = document.createElement("tr");

  const nameCell = document.createElement("td");
  const nameWrap = document.createElement("div");
  nameWrap.className = "transaction-name";

  const icon = document.createElement("span");
  icon.className = `transaction-icon ${income ? "green" : "purple"}`;
  icon.textContent = categoryIcons[item.category] || "📌";

  const details = document.createElement("div");
  const title = document.createElement("div");
  title.textContent = item.title;
  const sub = document.createElement("div");
  sub.className = "transaction-sub";
  sub.textContent = income ? "Money received" : "Money spent";
  details.append(title, sub);
  nameWrap.append(icon, details);
  nameCell.append(nameWrap);

  const categoryCell = document.createElement("td");
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = categoryLabels[item.category] || item.category;
  categoryCell.append(tag);

  const dateCell = document.createElement("td");
  dateCell.textContent = formatDate(item.date);

  const amountCell = document.createElement("td");
  amountCell.className = income ? "positive" : "negative";
  amountCell.style.fontWeight = "700";
  amountCell.textContent = `${income ? "+" : "−"}${formatMoney(item.amount)}`;

  row.append(nameCell, categoryCell, dateCell, amountCell);

  if (showDelete) {
    const actionCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "danger-btn";
    button.textContent = "Delete";
    button.addEventListener("click", () => deleteTransaction(item.id));
    actionCell.append(button);
    row.append(actionCell);
  }

  return row;
}

function renderTable(tbodySelector, searchSelector, { limit, showDelete }) {
  const searchTerm = $(searchSelector).value.toLowerCase().trim();
  const filtered = transactions.filter((item) =>
    item.title.toLowerCase().includes(searchTerm) ||
    String(item.category).toLowerCase().includes(searchTerm)
  );
  const rows = typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  const tbody = $(tbodySelector);
  tbody.replaceChildren();

  if (rows.length === 0) {
    const empty = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = showDelete ? 5 : 4;
    cell.className = "empty-state";
    cell.textContent = transactions.length === 0
      ? "No transactions yet. Add one to get started."
      : "No matching transactions found.";
    empty.append(cell);
    tbody.append(empty);
    return;
  }

  rows.forEach((item) => tbody.append(createTransactionRow(item, { showDelete })));
}

function renderTransactions() {
  renderTable("#recentRows", "#searchInput", { limit: 8, showDelete: false });
  renderTable("#transactionRows", "#searchAllInput", { showDelete: true });
}

function refreshDashboard() {
  updateSummary();
  renderChart();
  renderCategories();
  renderReports();
  fillSettings();
  renderTransactions();
}


async function loadAccountData() {
  const profile = await window.expenseAPI.getProfile();

  if (!profile.exists) {
    return { needsSetup: true };
  }

  userProfile = {
    openingBalance: Number(profile.openingBalance) || 0,
    monthlyIncome: Number(profile.monthlyIncome) || 0
  };

  // Create this month's salary, if it doesn't already exist.
  await window.expenseAPI.ensureCurrentMonthSalary();

  // Read transactions after ensuring the salary exists.
  const saved = await window.expenseAPI.read();
  transactions = Array.isArray(saved) ? saved : [];

  return { needsSetup: false };
}

async function initializeApp() {
  $("#bootScreen").classList.remove("hidden");
  $("#landingPage").classList.remove("is-visible");
  $("#authScreen").classList.remove("is-visible");
  $("#setupScreen").classList.remove("is-visible");
  $("#appShell").classList.remove("is-visible");

  try {
    const auth = await window.expenseAPI.currentUser();

    if (!auth.success || !auth.user) {
      currentUser = null;
      showLanding();
      return;
    }

    currentUser = auth.user;
    updateUserChrome();

    const account = await loadAccountData();
    if (account.needsSetup) {
      showSetupScreen();
      return;
    }

    showDashboard();
    refreshDashboard();
  } catch (error) {
    showLanding();
    $("#authMessage").textContent = friendlyClientError(
      error,
      "Could not load your account. Please try logging in again."
    );
  }
}

async function handleLogout() {
  try {
    await window.expenseAPI.logout();
  } catch (error) {
    console.error("Logout failed:", error);
  }

  transactions = [];
  userProfile = { openingBalance: 0, monthlyIncome: 0 };
  currentUser = null;
  $("#authForm").reset();
  showLanding();
}

function openModal() {
  $("#expenseMessage").textContent = "";
  $("#date").value = todayISO();
  $("#expenseModal").classList.add("open");
}

function closeModal() {
  $("#expenseModal").classList.remove("open");
}

async function deleteTransaction(id) {
  const confirmed = window.confirm("Delete this transaction?");
  if (!confirmed) return;

  try {
    await window.expenseAPI.remove(id);
    transactions = transactions.filter((item) => item.id !== id);
    refreshDashboard();
  } catch (error) {
    window.alert(friendlyClientError(error, "Could not delete this transaction."));
  }
}

$("#todayLabel").textContent = new Date().toLocaleDateString("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric"
});
$("#date").value = todayISO();

$("#landingLogin").addEventListener("click", () => showAuthScreen("login"));
$("#landingSignup").addEventListener("click", () => showAuthScreen("register"));
$("#landingGetStarted").addEventListener("click", () => showAuthScreen("register"));
$("#authBack").addEventListener("click", showLanding);
$("#setupLogout").addEventListener("click", handleLogout);
$("#logoutBtn").addEventListener("click", handleLogout);
$("#settingsLogout").addEventListener("click", handleLogout);

$("#toggleAuth").addEventListener("click", () => {
  showAuthScreen(authMode === "login" ? "register" : "login");
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view));
});

$("#viewAllBtn").addEventListener("click", () => {
  $("#searchAllInput").value = "";
  setView("transactions");
  renderTransactions();
});

$("#searchInput").addEventListener("input", renderTransactions);
$("#searchAllInput").addEventListener("input", renderTransactions);
$("#chartPeriod").addEventListener("change", renderChart);

$("#openModalBtn").addEventListener("click", openModal);
$("#closeModalBtn").addEventListener("click", closeModal);
$("#cancelBtn").addEventListener("click", closeModal);
$("#expenseModal").addEventListener("click", (event) => {
  if (event.target === $("#expenseModal")) closeModal();
});

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const message = $("#authMessage");
  const submit = $("#authSubmit");

  if (!email || !password) {
    message.textContent = "Email and password are required.";
    return;
  }

  if (password.length < 6) {
    message.textContent = "Password must be at least 6 characters.";
    return;
  }

  submit.disabled = true;
  message.textContent = "Please wait...";

  try {
    const result = authMode === "login"
      ? await window.expenseAPI.login({ email, password })
      : await window.expenseAPI.register({ email, password });

    if (!result.success) {
      message.textContent = result.message || "Authentication failed.";
      return;
    }

    if (authMode === "register" && !result.user) {
      message.textContent =
        result.message || "Account created. Confirm your email, then log in.";
      authMode = "login";
      $("#authSubmit").textContent = "Log In";
      $("#toggleAuth").textContent = "New here? Create an account";
      return;
    }

    await initializeApp();
  } catch (error) {
    message.textContent = friendlyClientError(error, "Authentication failed.");
  } finally {
    submit.disabled = false;
  }
});

$("#setupForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const openingBalance = Number($("#openingBalance").value);
  const monthlyIncome = Number($("#monthlyIncome").value);
  const message = $("#setupMessage");
  const submit = $("#setupSubmit");

  if (
    !Number.isFinite(openingBalance) ||
    !Number.isFinite(monthlyIncome) ||
    openingBalance < 0 ||
    monthlyIncome < 0
  ) {
    message.textContent = "Please enter valid, non-negative amounts.";
    return;
  }

  submit.disabled = true;
  submit.textContent = "Saving...";
  message.textContent = "";

  try {
    await window.expenseAPI.saveProfile({ openingBalance, monthlyIncome });
    userProfile = { openingBalance, monthlyIncome };
    const saved = await window.expenseAPI.read();
    transactions = Array.isArray(saved) ? saved : [];
    updateUserChrome();
    showDashboard();
    refreshDashboard();
  } catch (error) {
    message.textContent = friendlyClientError(error, "Could not save your details.");
  } finally {
    submit.disabled = false;
    submit.textContent = "Save & Continue";
  }
});

$("#settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const openingBalance = Number($("#settingsOpeningBalance").value);
  const monthlyIncome = Number($("#settingsMonthlyIncome").value);
  const message = $("#settingsMessage");
  const submit = $("#settingsSubmit");

  if (
    !Number.isFinite(openingBalance) ||
    !Number.isFinite(monthlyIncome) ||
    openingBalance < 0 ||
    monthlyIncome < 0
  ) {
    message.textContent = "Please enter valid, non-negative amounts.";
    return;
  }

  submit.disabled = true;
  message.textContent = "Saving...";

  try {
    await window.expenseAPI.saveProfile({ openingBalance, monthlyIncome });
    userProfile = { openingBalance, monthlyIncome };
    message.textContent = "Saved.";
    refreshDashboard();
  } catch (error) {
    message.textContent = friendlyClientError(error, "Could not save your profile.");
  } finally {
    submit.disabled = false;
  }
});

$("#expenseForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = $("#title").value.trim();
  const amount = Number($("#amount").value);
  const category = $("#category").value;
  const date = $("#date").value;
  const message = $("#expenseMessage");
  const submit = $("#expenseSubmit");

  if (!title || !Number.isFinite(amount) || amount <= 0 || !date) {
    message.textContent = "Please enter a valid title, amount, and date.";
    return;
  }

  submit.disabled = true;
  message.textContent = "";

  try {
    const saved = await window.expenseAPI.add({
      id: crypto.randomUUID(),
      title,
      amount,
      category,
      date
    });

    transactions = [saved, ...transactions];
    refreshDashboard();
    $("#expenseForm").reset();
    $("#date").value = todayISO();
    closeModal();
  } catch (error) {
    message.textContent = friendlyClientError(error, "Transaction could not be saved.");
  } finally {
    submit.disabled = false;
  }
});

initializeApp();
