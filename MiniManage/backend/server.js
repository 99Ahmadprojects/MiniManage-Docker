const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = process.env.DATABASE_PATH || '/app/db/items.db';

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite Database
let db;
let dbReady = false;

function initDb() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Database opening error: ', err);
                reject(err);
            } else {
                console.log('Connected to SQLite database at', DB_PATH);
                initializeSchema().then(resolve).catch(reject);
            }
        });
    });
}

// Initialize database schema
function initializeSchema() {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating table: ', err);
                reject(err);
            } else {
                console.log('Database schema initialized');
                dbReady = true;
                resolve();
            }
        });
    });
}

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running', dbReady: dbReady });
});

// Get all items
app.get('/api/items', (req, res) => {
    if (!dbReady) {
        return res.status(503).json({ error: 'Database not ready' });
    }
    
    db.all(`
        SELECT id, name, description, created_at FROM items 
        ORDER BY created_at DESC
    `, (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch items' });
        }
        res.json(rows || []);
    });
});

// Get single item by ID
app.get('/api/items/:id', (req, res) => {
    if (!dbReady) {
        return res.status(503).json({ error: 'Database not ready' });
    }
    
    const { id } = req.params;
    db.get(
        'SELECT * FROM items WHERE id = ?',
        [id],
        (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch item' });
            }
            if (!row) {
                return res.status(404).json({ error: 'Item not found' });
            }
            res.json(row);
        }
    );
});

// Add new item
app.post('/api/items', (req, res) => {
    if (!dbReady) {
        return res.status(503).json({ error: 'Database not ready' });
    }
    
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Item name is required and must be a string' });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description ? description.trim() : null;

    db.run(
        'INSERT INTO items (name, description) VALUES (?, ?)',
        [trimmedName, trimmedDescription],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to add item', details: err.message });
            }
            console.log('Item added with ID:', this.lastID);
            res.status(201).json({
                id: this.lastID,
                name: trimmedName,
                description: trimmedDescription,
                created_at: new Date().toISOString()
            });
        }
    );
});

// Update item
app.put('/api/items/:id', (req, res) => {
    if (!dbReady) {
        return res.status(503).json({ error: 'Database not ready' });
    }
    
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Item name is required and must be a string' });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description ? description.trim() : null;

    db.run(
        'UPDATE items SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [trimmedName, trimmedDescription, id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to update item' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Item not found' });
            }
            res.json({
                id: parseInt(id),
                name: trimmedName,
                description: trimmedDescription,
                updated_at: new Date().toISOString()
            });
        }
    );
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
    if (!dbReady) {
        return res.status(503).json({ error: 'Database not ready' });
    }
    
    const { id } = req.params;

    db.run(
        'DELETE FROM items WHERE id = ?',
        [id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to delete item' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Item not found' });
            }
            res.json({ message: 'Item deleted successfully', id: parseInt(id) });
        }
    );
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
    try {
        await initDb();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Visit http://localhost:${PORT}/health to check health`);
            console.log(`Database path: ${DB_PATH}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Closing database...');
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed');
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});
