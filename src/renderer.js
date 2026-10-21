
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("expense-form");

  if (!form) {
    console.error("Expense form not found in index.html");
    return;
  }

  let expenses = [];

  try {
    expenses = await window.expenseAPI.read();
  } catch (error) {
    console.error("Could not load expenses:", error);
    alert("Could not load saved expenses.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    const amount = Number(formData.get("amount"));
    const category = String(formData.get("category") || "").trim();
    const date = String(formData.get("date") || "").trim();
    const description = String(
      formData.get("description") || ""
    ).trim();

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !category ||
      !date ||
      !description
    ) {
      alert("Please enter valid expense details.");
      return;
    }

    const expense = {
      id: crypto.randomUUID(),
      amount,
      category,
      date,
      description,
      type: "expense"
    };

    try {
      const updatedExpenses = [...expenses, expense];

      await window.expenseAPI.save(updatedExpenses);

      expenses = updatedExpenses;
      form.reset();

      alert("Expense saved successfully!");
      console.log("Saved expenses:", expenses);
    } catch (error) {
      console.error("Could not save expense:", error);
      alert("Could not save expense. Please try again.");
    }
  });
});
