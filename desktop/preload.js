const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("expenseAPI", {
  read: () => ipcRenderer.invoke("expenses:read"),
  save: (expenses) => ipcRenderer.invoke("expenses:save", expenses),
  add: (expense) => ipcRenderer.invoke("expenses:add", expense),
  remove: (id) => ipcRenderer.invoke("expenses:delete", id),

  testSupabase: () => ipcRenderer.invoke("supabase:test"),
ensureCurrentMonthSalary: () =>
  ipcRenderer.invoke("salary:ensure-current-month"),
  register: (credentials) =>
    ipcRenderer.invoke("auth:register", credentials),

  login: (credentials) =>
    ipcRenderer.invoke("auth:login", credentials),

  logout: () =>
    ipcRenderer.invoke("auth:logout"),

  currentUser: () =>
    ipcRenderer.invoke("auth:current-user"),

  getProfile: () => ipcRenderer.invoke("profile:get"),
  saveProfile: (profile) => ipcRenderer.invoke("profile:save", profile)
});
