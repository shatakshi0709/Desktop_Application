
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("expenseAPI", {
  read: () => ipcRenderer.invoke("expenses:read"),
  save: (expenses) => ipcRenderer.invoke("expenses:save", expenses),

  testSupabase: () => ipcRenderer.invoke("supabase:test"),

  register: (credentials) =>
    ipcRenderer.invoke("auth:register", credentials),

  login: (credentials) =>
    ipcRenderer.invoke("auth:login", credentials),

  logout: () =>
    ipcRenderer.invoke("auth:logout"),

  currentUser: () =>
    ipcRenderer.invoke("auth:current-user")
});
