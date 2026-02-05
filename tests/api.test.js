const request = require('supertest');

// Mock functions must be defined before jest.mock calls
const mockProcessMessage = jest.fn().mockResolvedValue({
    reply: "Mock Reply",
    history: []
});
const mockProcessMessageStream = jest.fn();

// Mock Agent
jest.mock('../src/agent/brain', () => {
    return {
        Agent: jest.fn().mockImplementation(() => {
            return {
                processMessage: mockProcessMessage,
                processMessageStream: mockProcessMessageStream
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
    initData: jest.fn().mockResolvedValue(),
    getAllProducts: jest.fn().mockResolvedValue([])
}));

// Mock vector-store to prevent initialization errors
jest.mock('../src/utils/vector-store', () => ({
    initializeEmbeddings: jest.fn().mockResolvedValue(),
    vectorSearch: jest.fn()
}));

// Require app AFTER all mocks are set up
const app = require('../src/server');

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

    // Tests for Streaming Chat Endpoint
    describe('POST /api/chat/stream', () => {
        beforeEach(() => {
            mockProcessMessageStream.mockReset();
        });

        test('should return 400 error in SSE format if message is missing', async () => {
            const res = await request(app)
                .post('/api/chat/stream')
                .send({});

            expect(res.statusCode).toEqual(200); // SSE always returns 200
            expect(res.headers['content-type']).toContain('text/event-stream');
            expect(res.text).toContain('data: {"type":"error","content":"Message is required"}');
        });

        test('should stream events from processMessageStream', async () => {
            // Create async generator mock
            mockProcessMessageStream.mockImplementation(async function* () {
                yield { type: 'content', content: 'Hello' };
                yield { type: 'content', content: ' World' };
                yield { type: 'done', history: [{ role: 'user', content: 'test' }] };
            });

            const res = await request(app)
                .post('/api/chat/stream')
                .send({ message: "Hello" });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['content-type']).toContain('text/event-stream');
            expect(res.text).toContain('data: {"type":"content","content":"Hello"}');
            expect(res.text).toContain('data: {"type":"content","content":" World"}');
            expect(res.text).toContain('data: {"type":"done"');
        });

        test('should handle stream errors gracefully', async () => {
            mockProcessMessageStream.mockImplementation(async function* () {
                yield { type: 'content', content: 'Starting...' };
                throw new Error('Stream error');
            });

            const res = await request(app)
                .post('/api/chat/stream')
                .send({ message: "Hello" });

            expect(res.statusCode).toEqual(200);
            expect(res.text).toContain('data: {"type":"error","content":"Internal Server Error"}');
        });

        test('should include status events for tool calls', async () => {
            mockProcessMessageStream.mockImplementation(async function* () {
                yield { type: 'status', content: '正在搜索产品...' };
                yield { type: 'content', content: 'Found products!' };
                yield { type: 'done', history: [] };
            });

            const res = await request(app)
                .post('/api/chat/stream')
                .send({ message: "find me something for sleep" });

            expect(res.statusCode).toEqual(200);
            expect(res.text).toContain('正在搜索产品...');
            expect(res.text).toContain('Found products!');
        });
    });
});
