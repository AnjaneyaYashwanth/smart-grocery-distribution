const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const STATIC_FILE = path.join(__dirname, "data/static.json");
const ORDERS_FILE = path.join(__dirname, "data/orders.json");
const RECEIPTS_FILE = path.join(__dirname, "data/receipts.json");

/* ================= INIT ================= */
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
}

if (!fs.existsSync(RECEIPTS_FILE)) {
  fs.writeFileSync(RECEIPTS_FILE, JSON.stringify([], null, 2));
}

const readStatic = () => JSON.parse(fs.readFileSync(STATIC_FILE));
const readOrders = () => JSON.parse(fs.readFileSync(ORDERS_FILE));
const writeOrders = (data) =>
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2));

const readReceipts = () => JSON.parse(fs.readFileSync(RECEIPTS_FILE));
const writeReceipts = (data) =>
  fs.writeFileSync(RECEIPTS_FILE, JSON.stringify(data, null, 2));

/* ================= ROUTES ================= */
app.get("/cities", (req, res) => res.json(readStatic().cities));
app.get("/items", (req, res) => res.json(readStatic().items));
app.get("/orders", (req, res) => res.json(readOrders()));
app.get("/receipts", (req, res) => res.json(readReceipts()));

/* ================= ORDER CODE ================= */
const generateOrderCode = (city, orders) => {
  const prefix = city.slice(0, 3).toUpperCase();
  const count = orders.filter(o => o.city === city).length + 1;
  return `${prefix}-${String(count).padStart(3, "0")}`;
};

/* ================= FIXED PRICE ================= */
const getItemPrice = (itemName, orders) => {
  for (let order of orders) {
    const found = order.items.find(it => it.name === itemName);
    if (found) return found.price;
  }
  return Math.floor(Math.random() * 50) + 10;
};

/* ================= CREATE ORDER ================= */
app.post("/order", (req, res) => {
  const orders = readOrders();

  if (!req.body.city || !Array.isArray(req.body.items)) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const newOrder = {
    id: Date.now(),
    orderCode: generateOrderCode(req.body.city, orders),
    city: req.body.city,
    items: req.body.items.map(it => ({
      name: it.name,
      unit: it.unit,
      quantity: Number(it.quantity),
      price: getItemPrice(it.name, orders),
      accepted: 0,
      rejected: 0
    })),
    status: "Pending"
  };

  orders.push(newOrder);
  writeOrders(orders);

  res.json({ message: "Order placed" });
});

/* ================= ADMIN EDIT ================= */
app.put("/admin-edit/:id", (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.id === Number(req.params.id));

  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!Array.isArray(req.body.items))
    return res.status(400).json({ error: "Invalid items" });

  order.items = order.items.map((it, i) => ({
    ...it,
    quantity: Number(req.body.items[i]?.quantity || it.quantity)
  }));

  writeOrders(orders);
  res.json({ message: "Admin updated" });
});

/* ================= ADMIN ACCEPT ================= */
app.put("/admin-accept/:id", (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.id === Number(req.params.id));

  if (!order) return res.status(404).json({ error: "Order not found" });

  order.status = "Assigned";
  writeOrders(orders);

  res.json({ message: "Assigned" });
});

/* ================= SUPPLIER EDIT ================= */
app.put("/supplier-edit/:id", (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.id === Number(req.params.id));

  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!Array.isArray(req.body.items))
    return res.status(400).json({ error: "Invalid items" });

  order.items = order.items.map((it, i) => ({
    ...it,
    quantity: Number(req.body.items[i]?.quantity || it.quantity)
  }));

  writeOrders(orders);
  res.json({ message: "Supplier updated" });
});

/* ================= DELIVER ================= */
app.put("/deliver/:id", (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.id === Number(req.params.id));

  if (!order) return res.status(404).json({ error: "Order not found" });

  order.status = "Delivered";
  writeOrders(orders);

  res.json({ message: "Delivered" });
});

/* ================= FINAL ACCEPT ================= */
app.put("/accept-all-items/:id", (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.id === Number(req.params.id));

  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!Array.isArray(req.body.items))
    return res.status(400).json({ error: "Invalid items data" });

  order.items = order.items.map((it, i) => {
    let accepted = Number(req.body.items[i]?.accepted);

    if (isNaN(accepted)) accepted = 0;
    if (accepted > it.quantity) accepted = it.quantity;
    if (accepted < 0) accepted = 0;

    return {
      ...it,
      accepted,
      rejected: it.quantity - accepted
    };
  });

  order.status = "Completed";
  writeOrders(orders);

  res.json({ message: "Completed" });
});

/* ================= GENERATE RECEIPT ================= */
app.post("/generate-receipt/:id", (req, res) => {
  const orders = readOrders();
  const receipts = readReceipts();

  const order = orders.find(o => o.id === Number(req.params.id));

  if (!order) return res.status(404).json({ error: "Order not found" });

  if (order.status !== "Completed") {
    return res.status(400).json({ error: "Order not completed" });
  }

  const alreadyExists = receipts.find(r => r.orderId === order.id);
  if (alreadyExists) {
    return res.json({ message: "Already generated" });
  }

  const receipt = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    orderId: order.id,
    orderCode: order.orderCode,
    city: order.city,
    items: order.items.map(it => ({
      name: it.name,
      quantity: it.accepted,
      unit: it.unit,
      price: it.price,
      total: it.accepted * it.price
    })),
    totalAmount: order.items.reduce(
      (sum, it) => sum + (it.accepted * it.price),
      0
    )
  };

  receipts.push(receipt);
  writeReceipts(receipts);

  res.json({ message: "Receipt generated" });
});

/* ================= SERVER ================= */
app.listen(5000, () =>
  console.log("Server running on http://localhost:5000")
);