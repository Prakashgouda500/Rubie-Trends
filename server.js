const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors()); 
app.use(express.json()); 

// 1. Setup MySQL Connection
require("dotenv").config();

const mysql = require("mysql2");

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: true
    }
});

db.connect((err) => {
    if (err) {
        console.error("TiDB connection failed:", err);
        return;
    }

    console.log("Connected to TiDB Cloud!");
});
// 2. PRODUCT ROUTES

// Get average rating for ALL products (Must be ABOVE :id route)
app.get('/api/products/averages', (req, res) => {
    const sql = `
        SELECT product_id, AVG(rating) as avgRating, COUNT(id) as totalReviews 
        FROM reviews 
        GROUP BY product_id`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// Get all products
app.get('/api/products', (req, res) => {
    const sql = "SELECT * FROM products";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// Get a single product by ID
app.get('/api/products/:id', (req, res) => {
    const sql = "SELECT * FROM products WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result[0]);
    });
});

// Admin: Add a product
app.post('/api/admin/add', (req, res) => {
    const { name, price, stock, image_url, description, category } = req.body;
    const sql = "INSERT INTO products (name, price, stock, image_url, description, category) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(sql, [name, price, stock, image_url, description, category], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send({ message: "Product Added!" });
    });
});

// Admin: Delete a product
app.delete('/api/admin/delete/:id', (req, res) => {
    const sql = "DELETE FROM products WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send({ message: "Product deleted!" });
    });
});

// Admin: Update a product
app.put('/api/admin/update/:id', (req, res) => {
    const { price, stock, category, image_url, description } = req.body;
    const sql = "UPDATE products SET price = ?, stock = ?, category = ?, image_url = ?, description = ? WHERE id = ?";
    db.query(sql, [price, stock, category, image_url, description, req.params.id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send({ message: "Updated successfully!" });
    });
});

// 3. USER & ORDER ROUTES

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
    db.query(sql, [username, password], (err, result) => {
        if (result.length > 0) {
            res.send({ success: true, user: result[0] });
        } else {
            res.status(401).send({ success: false, message: "Invalid credentials" });
        }
    });
});

// Save Order
app.post('/api/orders', (req, res) => {
    const { user_id, total_amount, items } = req.body;
    const sql = "INSERT INTO orders (user_id, total_amount, items) VALUES (?, ?, ?)";
    db.query(sql, [user_id, total_amount, JSON.stringify(items)], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send({ success: true, orderId: result.insertId });
    });
});

// Get Order History
app.get('/api/orders/:user_id', (req, res) => {
    const sql = "SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC";
    db.query(sql, [req.params.user_id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

// 4. REVIEW ROUTES

// Post a review
app.post('/api/reviews', (req, res) => {
    const { product_id, user_name, rating, comment } = req.body;
    const sql = "INSERT INTO reviews (product_id, user_name, rating, comment) VALUES (?, ?, ?, ?)";
    db.query(sql, [product_id, user_name, rating, comment], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send({ message: "Review Added!" });
    });
});

// Get reviews for a specific product
app.get('/api/reviews/:product_id', (req, res) => {
    const sql = "SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC";
    db.query(sql, [req.params.product_id], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});


app.get('/api/products/averages', (req, res) => {
    const query = `
        SELECT product_id, AVG(rating) as avgRating 
        FROM reviews 
        GROUP BY product_id`;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});


// Signup Route
app.post('/api/signup', (req, res) => {
    const { username, email, password } = req.body;

    // Check if user already exists
    const checkUser = "SELECT * FROM users WHERE username = ? OR email = ?";
    db.query(checkUser, [username, email], (err, results) => {
        if (err) return res.status(500).send(err);
        
        if (results.length > 0) {
            return res.status(400).send({ success: false, message: "Username or Email already exists" });
        }

        // Insert new user
        const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        db.query(sql, [username, email, password], (err, result) => {
            if (err) return res.status(500).send(err);
            res.send({ success: true, message: "User registered successfully!", userId: result.insertId });
        });
    });
});



// Forgot Password - Reset Route
app.post('/api/forgot-password', (req, res) => {
    const { username, email, newPassword } = req.body;

    // 1. Check if the user and email match
    const checkUser = "SELECT * FROM users WHERE username = ? AND email = ?";
    db.query(checkUser, [username, email], (err, results) => {
        if (err) return res.status(500).send(err);
        
        if (results.length === 0) {
            return res.status(404).send({ success: false, message: "No matching user found with those details." });
        }

        // 2. Update the password
        const updateSql = "UPDATE users SET password = ? WHERE username = ? AND email = ?";
        db.query(updateSql, [newPassword, username, email], (updateErr, result) => {
            if (updateErr) return res.status(500).send(updateErr);
            res.send({ success: true, message: "Password updated successfully!" });
        });
    });
});



app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = "SELECT id, username, email FROM users WHERE username = ? AND password = ?";
    
    db.query(sql, [username, password], (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length > 0) {
            // This 'results[0]' is what becomes 'data.user' in your HTML
            res.send({ success: true, user: results[0] }); 
        } else {
            res.send({ success: false, message: "Invalid credentials" });
        }
    });
});



// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
