const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/products", (req, res) => {
  res.json([
    { id: 1, name: "Wireless Mouse", gemPrice: 450, otherPrice: 399 },
    { id: 2, name: "Keyboard", gemPrice: 800, otherPrice: 850 },
    { id: 3, name: "Office Chair", gemPrice: 3500, otherPrice: 3200 },
  ]);
});

app.listen(5001, () => {
  console.log("Backend server running on port 5001");
});