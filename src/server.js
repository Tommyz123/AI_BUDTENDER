require('dotenv').config();
const express = require('express');
const path = require('path');
const { Agent } = require('./agent/brain');
const { getProductDetails } = require('./tools/product-details');
const { initData } = require('./data/product-repository');

const app = express();
const port = process.env.PORT || 3000;

// Initialize dependencies
const agent = new Agent();
initData().catch(console.error);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const response = await agent.processMessage(message, history || []);
        res.json(response);
    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Product Details Endpoint
app.get('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await getProductDetails(productId);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        console.error('Product API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start Server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

module.exports = app; // Export for testing
