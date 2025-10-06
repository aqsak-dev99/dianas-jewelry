require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const OpenAI = require("openai");
const db = require("./db"); // Import DB pool

const app = express();
const PORT = process.env.PORT || 5000;

// Validate OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not found in .env. Exiting.");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Middleware to extract userId (temporary, to be replaced with JWT)
const getUserId = (req) => {
  // TODO: Replace with JWT authentication
  return req.query.userId || req.body.userId || 1; // Fallback to userId 1
};

// ---------- Test Routes ----------

app.get("/api", (req, res) => {
  res.send("🚀 Backend API is running!");
});

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from Express backend!" });
});

// ---------- AI Routes ----------

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Valid message is required" });
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for a jewelry website. Keep answers short and friendly.",
        },
        { role: "user", content: message.trim() },
      ],
    });
    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error("❌ AI chat error:", error.message);
    res.status(500).json({ error: "Something went wrong with AI. Check logs." });
  }
});

app.post("/api/ask", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Valid search query is required" });
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a search assistant for a jewelry website. Provide a concise list of matching products or relevant information.",
        },
        { role: "user", content: message.trim() },
      ],
    });
    const answer = response.choices[0].message.content;
    res.json({ answer });
  } catch (error) {
    console.error("❌ AI search error:", error.message);
    res.status(500).json({ error: "Something went wrong with search." });
  }
});

// ---------- Database Routes ----------

app.get("/api/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT NOW() AS now");
    res.json({ message: "DB connected!", time: rows[0].now });
  } catch (err) {
    console.error("❌ DB test error:", err.message);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// ---------- Product Routes ----------

app.get("/api/products", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT p.id, p.name, p.price, p.image_url, p.description, p.category_id, c.name AS category_name " +
      "FROM products p LEFT JOIN categories c ON p.category_id = c.id"
    );
    if (!rows.length) {
      return res.status(404).json({ error: "No products found" });
    }
    res.json(rows);
  } catch (err) {
    console.error("❌ DB error fetching products:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT p.id, p.name, p.price, p.image_url, p.description, p.category_id, c.name AS category_name " +
      "FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?",
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ DB error fetching product:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------- Category Routes ----------

app.get("/api/categories", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name FROM categories");
    if (!rows.length) {
      return res.status(404).json({ error: "No categories found" });
    }
    res.json(rows);
  } catch (err) {
    console.error("❌ DB error fetching categories:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/categories/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name FROM categories WHERE id = ?", [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ DB error fetching category:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------- Wishlist Routes ----------

app.get("/api/wishlist", async (req, res) => {
  try {
    const userId = getUserId(req);
    const [rows] = await db.query(
      "SELECT w.id, w.user_id, w.product_id, p.name, p.price, p.image_url " +
      "FROM wishlist w JOIN products p ON w.product_id = p.id WHERE w.user_id = ?",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ DB error fetching wishlist:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/wishlist/add", async (req, res) => {
  try {
    const { product_id } = req.body;
    const userId = getUserId(req);
    if (!product_id) {
      return res.status(400).json({ error: "Product ID is required" });
    }
    const [product] = await db.query(
      "SELECT id FROM products WHERE id = ?",
      [product_id]
    );
    if (!product.length) {
      return res.status(404).json({ error: "Product not found" });
    }
    const [existing] = await db.query(
      "SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?",
      [userId, product_id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "Product already in wishlist" });
    }
    await db.query(
      "INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)",
      [userId, product_id]
    );
    res.json({ message: "Added to wishlist" });
  } catch (err) {
    console.error("❌ DB error adding to wishlist:", err.message);
    res.status(500).json({ error: err.code === 'ER_DUP_ENTRY' ? "Product already in wishlist" : "Database error" });
  }
});

app.delete("/api/wishlist/remove/:product_id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const [result] = await db.query(
      "DELETE FROM wishlist WHERE user_id = ? AND product_id = ?",
      [userId, req.params.product_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Item not found in wishlist" });
    }
    res.json({ message: "Removed from wishlist" });
  } catch (err) {
    console.error("❌ DB error removing from wishlist:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------- Cart Routes ----------

app.get("/api/cart", async (req, res) => {
  try {
    const userId = getUserId(req);
    const [rows] = await db.query(
      "SELECT c.id, c.user_id, c.product_id, c.quantity, c.variant, p.name, p.price, p.image_url " +
      "FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ DB error fetching cart:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/cart/add", async (req, res) => {
  try {
    const { product_id, quantity, variant } = req.body;
    const userId = getUserId(req);
    if (!product_id || !quantity || quantity < 1) {
      return res.status(400).json({ error: "Product ID and valid quantity are required" });
    }
    const [product] = await db.query(
      "SELECT id, name, price, image_url FROM products WHERE id = ?",
      [product_id]
    );
    if (!product.length) {
      return res.status(404).json({ error: "Product not found" });
    }
    const [existing] = await db.query(
      "SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ? AND (variant = ? OR ? IS NULL)",
      [userId, product_id, variant || null, variant || null]
    );
    if (existing.length > 0) {
      await db.query(
        "UPDATE cart SET quantity = quantity + ? WHERE user_id = ? AND product_id = ? AND (variant = ? OR ? IS NULL)",
        [quantity, userId, product_id, variant || null, variant || null]
      );
    } else {
      await db.query(
        "INSERT INTO cart (user_id, product_id, quantity, variant) VALUES (?, ?, ?, ?)",
        [userId, product_id, quantity, variant || null]
      );
    }
    res.json({ message: "Added to cart" });
  } catch (err) {
    console.error("❌ DB error adding to cart:", err.message);
    res.status(500).json({ error: err.code === 'ER_DUP_ENTRY' ? "Product already in cart" : "Database error" });
  }
});

app.put("/api/cart/update/:product_id", async (req, res) => {
  try {
    const { quantity, variant } = req.body;
    const userId = getUserId(req);
    if (!quantity || quantity < 0) {
      return res.status(400).json({ error: "Valid quantity is required" });
    }
    const [result] = await db.query(
      "UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ? AND (variant = ? OR ? IS NULL)",
      [quantity, userId, req.params.product_id, variant || null, variant || null]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Item not found in cart" });
    }
    res.json({ message: "Cart updated" });
  } catch (err) {
    console.error("❌ DB error updating cart:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/api/cart/remove/:product_id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const [result] = await db.query(
      "DELETE FROM cart WHERE user_id = ? AND product_id = ?",
      [userId, req.params.product_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Item not found in cart" });
    }
    res.json({ message: "Removed from cart" });
  } catch (err) {
    console.error("❌ DB error removing from cart:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/api/cart/clear", async (req, res) => {
  try {
    const userId = getUserId(req);
    await db.query("DELETE FROM cart WHERE user_id = ?", [userId]);
    res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error("❌ DB error clearing cart:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------- Newsletter Routes ----------

app.post("/api/newsletter", async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid name and email required" });
    }
    const [existing] = await db.query("SELECT id FROM newsletter WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Email already subscribed" });
    }
    await db.query("INSERT INTO newsletter (name, email) VALUES (?, ?)", [name, email]);
    res.json({ message: "Subscribed to newsletter" });
  } catch (err) {
    console.error("❌ DB error subscribing to newsletter:", err.message);
    res.status(500).json({ error: err.code === 'ER_DUP_ENTRY' ? "Email already subscribed" : "Database error" });
  }
});

// ---------- Feedback Routes ----------

app.post("/api/feedback", async (req, res) => {
  try {
    const { name, email, feedback_type, comments } = req.body;
    if (!name || !email || !feedback_type || !comments || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "All fields are required with valid email" });
    }
    await db.query(
      "INSERT INTO feedback (name, email, feedback_type, comments) VALUES (?, ?, ?, ?)",
      [name, email, feedback_type, comments]
    );
    res.json({ message: "Feedback submitted" });
  } catch (err) {
    console.error("❌ DB error submitting feedback:", err.message);
    res.status(500).json({ error: err.code === 'ER_DUP_ENTRY' ? "Feedback already submitted" : "Database error" });
  }
});

// ---------- Order Routes ----------

app.post("/api/orders", async (req, res) => {
  try {
    const { userId, cart, shipping } = req.body;
    const finalUserId = userId || getUserId(req);
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Valid cart items required" });
    }
    for (const item of cart) {
      if (!item.product_id || isNaN(item.quantity) || item.quantity < 1) {
        return res.status(400).json({ error: "Invalid cart item data" });
      }
      const [product] = await db.query("SELECT price, name, image_url FROM products WHERE id = ?", [item.product_id]);
      if (!product.length) {
        return res.status(404).json({ error: `Product ID ${item.product_id} not found` });
      }
      item.price = product[0].price;
      item.name = product[0].name;
      item.image_url = product[0].image_url;
    }
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0) + 5.00; // Add shipping cost
    const [result] = await db.query(
      "INSERT INTO orders (user_id, total, shipping, items) VALUES (?, ?, ?, ?)",
      [finalUserId, total, JSON.stringify(shipping), JSON.stringify(cart)]
    );
    const orderId = result.insertId;
    for (const item of cart) {
      await db.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
        [orderId, item.product_id, item.quantity, item.price]
      );
    }
    await db.query("DELETE FROM cart WHERE user_id = ?", [finalUserId]);
    res.json({ message: "Order placed", orderId });
  } catch (err) {
    console.error("❌ DB error placing order:", err.message);
    res.status(500).json({ error: err.code === 'ER_DUP_ENTRY' ? "Order already exists" : "Database error" });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const userId = getUserId(req);
    const [orders] = await db.query(
      "SELECT id, user_id, total, created_at, shipping, items FROM orders WHERE user_id = ?",
      [userId]
    );
    for (let order of orders) {
      const [items] = await db.query(
        "SELECT oi.id, oi.product_id, oi.quantity, oi.price, p.name, p.image_url " +
        "FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?",
        [order.id]
      );
      order.items = items;
    }
    res.json(orders);
  } catch (err) {
    console.error("❌ DB error fetching orders:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------- Order Items Routes ----------

app.get("/api/order_items/:orderId", async (req, res) => {
  try {
    const userId = getUserId(req);
    const [rows] = await db.query(
      "SELECT oi.id, oi.product_id, oi.quantity, oi.price, p.name, p.image_url " +
      "FROM order_items oi JOIN products p ON oi.product_id = p.id " +
      "WHERE oi.order_id = ? AND EXISTS (SELECT 1 FROM orders o WHERE o.id = ? AND o.user_id = ?)",
      [req.params.orderId, req.params.orderId, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "No items found for this order" });
    }
    res.json(rows);
  } catch (err) {
    console.error("❌ DB error fetching order items:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------- Customer Routes ----------

app.post("/api/customers/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      return res.status(400).json({ error: "Valid name, email, and password (min 6 chars) required" });
    }
    const [existing] = await db.query("SELECT id FROM customers WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Email already in use" });
    }
    // TODO: Hash password with bcrypt
    await db.query(
      "INSERT INTO customers (name, email, password) VALUES (?, ?, ?)",
      [name, email, password]
    );
    res.json({ message: "Account created" });
  } catch (err) {
    console.error("❌ DB error creating customer:", err.message);
    res.status(500).json({ error: err.code === 'ER_DUP_ENTRY' ? "Email already in use" : "Database error" });
  }
});

app.put("/api/customers/:id", async (req, res) => {
  try {
    const userId = req.params.id || getUserId(req);
    const { name, email } = req.body;
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid name and email required" });
    }
    const [existing] = await db.query("SELECT id FROM customers WHERE email = ? AND id != ?", [email, userId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Email already in use" });
    }
    const [result] = await db.query(
      "UPDATE customers SET name = ?, email = ? WHERE id = ?",
      [name, email, userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json({ message: "Customer info updated" });
  } catch (err) {
    console.error("❌ DB error updating customer:", err.message);
    res.status(500).json({ error: err.code === 'ER_DUP_ENTRY' ? "Email already in use" : "Database error" });
  }
});

app.put("/api/customers/:id/password", async (req, res) => {
  try {
    const userId = req.params.id || getUserId(req);
    const { newPassword, confirmPassword } = req.body;
    if (!newPassword || newPassword !== confirmPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Passwords do not match or are too short (min 6 chars)" });
    }
    // TODO: Hash password with bcrypt
    const [result] = await db.query(
      "UPDATE customers SET password = ? WHERE id = ?",
      [newPassword, userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json({ message: "Password updated" });
  } catch (err) {
    console.error("❌ DB error updating password:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------- Start Server ----------

app.listen(PORT, async () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`🔑 OpenAI key loaded: ${process.env.OPENAI_API_KEY ? "Yes" : "No"}`);
  try {
    const [rows] = await db.query("SELECT 1 AS test");
    console.log(`✅ Database connection verified: ${rows[0].test}`);
  } catch (err) {
    console.error("❌ Database connection failed on startup:", err.message);
  }
});