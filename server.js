require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());

// =====================================================
// DATABASE - TiDB Cloud
// =====================================================

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    ssl: {
        rejectUnauthorized: true
    },

    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

// Test database connection
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ TiDB connection failed:", err.message);
    } else {
        console.log("✅ Connected to TiDB Cloud!");
        connection.release();
    }
});

// =====================================================
// HOME / HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Rubie Trends API is running",
        database: "TiDB Cloud"
    });
});

// =====================================================
// PRODUCT ROUTES
// =====================================================

// Get average rating for ALL products
app.get("/api/products/averages", (req, res) => {
    const sql = `
        SELECT 
            product_id,
            AVG(rating) AS avgRating,
            COUNT(id) AS totalReviews
        FROM reviews
        GROUP BY product_id
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Average rating error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to get product ratings",
                error: err.message
            });
        }

        res.json(results);
    });
});

// Get all products
app.get("/api/products", (req, res) => {
    const sql = "SELECT * FROM products";

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Get products error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to get products",
                error: err.message
            });
        }

        res.json(results);
    });
});

// Get single product by ID
app.get("/api/products/:id", (req, res) => {
    const sql = "SELECT * FROM products WHERE id = ?";

    db.query(sql, [req.params.id], (err, result) => {
        if (err) {
            console.error("Get product error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to get product",
                error: err.message
            });
        }

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json(result[0]);
    });
});

// =====================================================
// ADMIN PRODUCT ROUTES
// =====================================================

// Add product
app.post("/api/admin/add", (req, res) => {
    const {
        name,
        price,
        stock,
        image_url,
        description,
        category
    } = req.body;

    const sql = `
        INSERT INTO products
        (name, price, stock, image_url, description, category)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [name, price, stock, image_url, description, category],
        (err, result) => {
            if (err) {
                console.error("Add product error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Failed to add product",
                    error: err.message
                });
            }

            res.json({
                success: true,
                message: "Product Added!",
                productId: result.insertId
            });
        }
    );
});

// Delete product
app.delete("/api/admin/delete/:id", (req, res) => {
    const sql = "DELETE FROM products WHERE id = ?";

    db.query(sql, [req.params.id], (err, result) => {
        if (err) {
            console.error("Delete product error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to delete product",
                error: err.message
            });
        }

        res.json({
            success: true,
            message: "Product deleted!"
        });
    });
});

// Update product
app.put("/api/admin/update/:id", (req, res) => {
    const {
        price,
        stock,
        category,
        image_url,
        description
    } = req.body;

    const sql = `
        UPDATE products
        SET
            price = ?,
            stock = ?,
            category = ?,
            image_url = ?,
            description = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            price,
            stock,
            category,
            image_url,
            description,
            req.params.id
        ],
        (err, result) => {
            if (err) {
                console.error("Update product error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Failed to update product",
                    error: err.message
                });
            }

            res.json({
                success: true,
                message: "Updated successfully!"
            });
        }
    );
});

// =====================================================
// USER ROUTES
// =====================================================

// LOGIN
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: "Username and password are required"
        });
    }

    const sql = `
        SELECT id, username, email
        FROM users
        WHERE username = ? AND password = ?
    `;

    db.query(
        sql,
        [username, password],
        (err, results) => {
            if (err) {
                console.error("Login error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err.message
                });
            }

            if (results.length > 0) {
                return res.json({
                    success: true,
                    user: results[0]
                });
            }

            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }
    );
});

// =====================================================
// SIGNUP
// =====================================================

app.post("/api/signup", (req, res) => {
    const {
        username,
        email,
        password
    } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "Username, email and password are required"
        });
    }

    // Check existing user
    const checkUser = `
        SELECT *
        FROM users
        WHERE username = ? OR email = ?
    `;

    db.query(
        checkUser,
        [username, email],
        (err, results) => {
            if (err) {
                console.error("Signup check error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err.message
                });
            }

            if (results.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Username or Email already exists"
                });
            }

            // Insert user
            const sql = `
                INSERT INTO users
                (username, email, password)
                VALUES (?, ?, ?)
            `;

            db.query(
                sql,
                [username, email, password],
                (err, result) => {
                    if (err) {
                        console.error("Signup insert error:", err);

                        return res.status(500).json({
                            success: false,
                            message: "Failed to create account",
                            error: err.message
                        });
                    }

                    res.json({
                        success: true,
                        message: "User registered successfully!",
                        userId: result.insertId
                    });
                }
            );
        }
    );
});

// =====================================================
// FORGOT PASSWORD
// =====================================================

app.post("/api/forgot-password", (req, res) => {
    const {
        username,
        email,
        newPassword
    } = req.body;

    if (!username || !email || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "Username, email and new password are required"
        });
    }

    // Check user
    const checkUser = `
        SELECT *
        FROM users
        WHERE username = ? AND email = ?
    `;

    db.query(
        checkUser,
        [username, email],
        (err, results) => {
            if (err) {
                console.error("Forgot password check error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: err.message
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No matching user found with those details."
                });
            }

            // Update password
            const updateSql = `
                UPDATE users
                SET password = ?
                WHERE username = ? AND email = ?
            `;

            db.query(
                updateSql,
                [newPassword, username, email],
                (updateErr) => {
                    if (updateErr) {
                        console.error(
                            "Password update error:",
                            updateErr
                        );

                        return res.status(500).json({
                            success: false,
                            message: "Failed to update password",
                            error: updateErr.message
                        });
                    }

                    res.json({
                        success: true,
                        message: "Password updated successfully!"
                    });
                }
            );
        }
    );
});

// =====================================================
// ORDER ROUTES
// =====================================================

// Save order
app.post("/api/orders", (req, res) => {
    const {
        user_id,
        total_amount,
        items
    } = req.body;

    if (!user_id || total_amount === undefined || !items) {
        return res.status(400).json({
            success: false,
            message: "user_id, total_amount and items are required"
        });
    }

    const sql = `
        INSERT INTO orders
        (user_id, total_amount, items)
        VALUES (?, ?, ?)
    `;

    db.query(
        sql,
        [
            user_id,
            total_amount,
            JSON.stringify(items)
        ],
        (err, result) => {
            if (err) {
                console.error("Order insert error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Failed to save order",
                    error: err.message
                });
            }

            res.json({
                success: true,
                orderId: result.insertId
            });
        }
    );
});

// Get order history
app.get("/api/orders/:user_id", (req, res) => {
    const sql = `
        SELECT *
        FROM orders
        WHERE user_id = ?
        ORDER BY order_date DESC
    `;

    db.query(
        sql,
        [req.params.user_id],
        (err, results) => {
            if (err) {
                console.error("Order history error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Failed to get order history",
                    error: err.message
                });
            }

            res.json(results);
        }
    );
});

// =====================================================
// REVIEW ROUTES
// =====================================================

// Add review
app.post("/api/reviews", (req, res) => {
    const {
        product_id,
        user_name,
        rating,
        comment
    } = req.body;

    if (!product_id || !user_name || !rating) {
        return res.status(400).json({
            success: false,
            message: "Product, user name and rating are required"
        });
    }

    const sql = `
        INSERT INTO reviews
        (product_id, user_name, rating, comment)
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            product_id,
            user_name,
            rating,
            comment
        ],
        (err, result) => {
            if (err) {
                console.error("Review insert error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Failed to add review",
                    error: err.message
                });
            }

            res.json({
                success: true,
                message: "Review Added!",
                reviewId: result.insertId
            });
        }
    );
});

// Get reviews for product
app.get("/api/reviews/:product_id", (req, res) => {
    const sql = `
        SELECT *
        FROM reviews
        WHERE product_id = ?
        ORDER BY created_at DESC
    `;

    db.query(
        sql,
        [req.params.product_id],
        (err, results) => {
            if (err) {
                console.error("Get reviews error:", err);

                return res.status(500).json({
                    success: false,
                    message: "Failed to get reviews",
                    error: err.message
                });
            }

            res.json(results);
        }
    );
});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found",
        path: req.originalUrl
    });
});

// =====================================================
// VERCEL EXPORT
// =====================================================

// IMPORTANT:
// Do NOT use app.listen() on Vercel.
// Vercel will run the Express app as a serverless function.

module.exports = app;
