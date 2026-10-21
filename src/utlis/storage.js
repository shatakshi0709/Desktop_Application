
const fs = require("node:fs/promises");
const path = require("node:path");
const { app } = require("electron");

const dataDirectory = app.getPath("userData");
const dataFile = path.join(dataDirectory, "expenses.json");

async function ensureDataFile() {
  await fs.mkdir(dataDirectory, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;

    await fs.writeFile(dataFile, "[]", "utf8");
  }
}

async function readExpenses() {
  await ensureDataFile();

  try {
    const content = await fs.readFile(dataFile, "utf8");
    const expenses = JSON.parse(content);

    if (!Array.isArray(expenses)) {
      throw new Error("Expense data must be an array.");
    }

    return expenses;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        "Expense data is corrupted. Please restore a valid backup."
      );
    }

    throw error;
  }
}

async function saveExpenses(expenses) {
  await ensureDataFile();

  const temporaryFile = `${dataFile}.tmp`;

  await fs.writeFile(
    temporaryFile,
    JSON.stringify(expenses, null, 2),
    "utf8"
  );

  await fs.rename(temporaryFile, dataFile);

  return { success: true };
}

module.exports = { readExpenses, saveExpenses };
