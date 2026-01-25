const request = require('supertest');
const app = require('../src/server');

// Mock Agent
jest.mock('../src/agent/brain', () => {
    return {
        Agent: jest.fn().mockImplementation(() => {
            return {
                processMessage: jest.fn().mockResolvedValue({
                    reply: "Mock Reply",
                    history: []
                })
            };
        })
    };
});

// Mock Tools used in Server
jest.mock('../src/tools/product-details', () => ({
    getProductDetails: jest.fn((id) => {
        if (id === 'prod_001') return Promise.resolve({ id: 'prod_001', name: 'Test' });
        return Promise.resolve(null);
    })
}));
// Data init mock handled implicitly or we can mock it
jest.mock('../src/data/product-repository', () => ({
    initData: jest.fn().mockResolvedValue()
}));


describe('Web Interface API', () => {
    // Tests for Chat Endpoint
    describe('POST /api/chat', () => {
        test('should return 400 if message is missing', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({}); // No message
            expect(res.statusCode).toEqual(400);
        });

        test('should return agent reply', async () => {
            const res = await request(app)
                .post('/api/chat')
                .send({ message: "Hello" });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('reply', 'Mock Reply');
        });
    });

    // Tests for Product Endpoint
    describe('GET /api/products/:id', () => {
        test('should return product details', async () => {
            const res = await request(app).get('/api/products/prod_001');
            expect(res.statusCode).toEqual(200);
            expect(res.body.id).toBe('prod_001');
        });

        test('should return 404 for unknown product', async () => {
            const res = await request(app).get('/api/products/unknown');
            expect(res.statusCode).toEqual(404);
        });
    });
});
