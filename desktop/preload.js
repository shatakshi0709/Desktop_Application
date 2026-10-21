
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("expenseAPI", {
  read: () => ipcRenderer.invoke("expenses:read"),

  save: (expenses) => {
    console.log("Saving expenses:", expenses);
    return ipcRenderer.invoke("expenses:save", expenses);
  }
});

