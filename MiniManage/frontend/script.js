// Determine the API URL based on the environment
const API_URL = (() => {
    // If running in Docker (hostname contains localhost or IP)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
    }
    // Otherwise assume same host with /api path
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
})();

let items = [];

// DOM Elements
const itemInput = document.getElementById('itemInput');
const descriptionInput = document.getElementById('descriptionInput');
const addBtn = document.getElementById('addBtn');
const itemsList = document.getElementById('itemsList');

// Event Listeners
addBtn.addEventListener('click', addItem);
itemInput.addEventListener('keypress', (e) => e.key === 'Enter' && addItem());
descriptionInput.addEventListener('keypress', (e) => e.key === 'Enter' && addItem());

// Check backend health
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_URL.replace('/api', '')}/health`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Backend health:', data);
        return data;
    } catch (error) {
        console.error('Backend health check failed:', error);
        return null;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for backend to be ready
    let retries = 0;
    const maxRetries = 10;
    
    while (retries < maxRetries) {
        const health = await checkBackendHealth();
        if (health && health.dbReady) {
            console.log('Backend is ready!');
            loadItems();
            break;
        }
        retries++;
        if (retries < maxRetries) {
            console.log(`Waiting for backend... (attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    if (retries >= maxRetries) {
        itemsList.innerHTML = '<p class="empty-state">Failed to connect to backend. Is it running?</p>';
    }
});

// Load items from backend
async function loadItems() {
    try {
        itemsList.innerHTML = '<p class="loading">Loading items...</p>';
        const response = await fetch(`${API_URL}/items`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        items = await response.json();
        renderItems();
    } catch (error) {
        console.error('Error loading items:', error);
        itemsList.innerHTML = '<p class="empty-state">Failed to load items. Is the backend running?</p>';
    }
}

// Add new item
async function addItem() {
    const name = itemInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!name) {
        alert('Please enter an item name');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const newItem = await response.json();
        items.push(newItem);
        renderItems();
        itemInput.value = '';
        descriptionInput.value = '';
        itemInput.focus();
    } catch (error) {
        console.error('Error adding item:', error);
        alert('Failed to add item. Is the backend running?');
    }
}

// Delete item
async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/items/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        items = items.filter(item => item.id !== id);
        renderItems();
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item');
    }
}

// Render items to UI
function renderItems() {
    if (items.length === 0) {
        itemsList.innerHTML = '<p class="empty-state">No items yet. Add one to get started!</p>';
        return;
    }

    itemsList.innerHTML = items.map(item => `
        <div class="item">
            <div class="item-content">
                <div class="item-name">${escapeHtml(item.name)}</div>
                ${item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : ''}
            </div>
            <button class="btn-delete" onclick="deleteItem(${item.id})">Delete</button>
        </div>
    `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
