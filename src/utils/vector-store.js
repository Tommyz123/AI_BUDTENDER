/**
 * Vector Store for semantic product search
 * Uses OpenAI text-embedding-3-small for embeddings
 */
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

const EMBEDDINGS_PATH = path.join(__dirname, '../../data/embeddings.json');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

let productEmbeddings = []; // { id, name, embedding, product }
let isInitialized = false;
let openai = null;

/**
 * Get OpenAI client (lazy initialization)
 */
function getOpenAI() {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'mock-key',
        });
    }
    return openai;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generate embedding text for a product
 * Combines name, type, effects, and description for better semantic matching
 */
function getProductEmbeddingText(product) {
    const parts = [
        product.name,
        product.type,
        product.effects.join(', '),
        product.description || ''
    ];
    return parts.filter(Boolean).join(' | ');
}

/**
 * Generate embedding for a single text
 */
async function generateEmbedding(text) {
    const client = getOpenAI();
    const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS
    });
    return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batches
 */
async function generateEmbeddingsBatch(texts, batchSize = 100) {
    const client = getOpenAI();
    const embeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        console.log(`[VectorStore] Generating embeddings ${i + 1}-${Math.min(i + batchSize, texts.length)} of ${texts.length}`);

        const response = await client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: batch,
            dimensions: EMBEDDING_DIMENSIONS
        });

        embeddings.push(...response.data.map(d => d.embedding));
    }

    return embeddings;
}

/**
 * Load embeddings from cache file
 */
async function loadEmbeddingsCache() {
    try {
        const data = await fs.readFile(EMBEDDINGS_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null; // File doesn't exist
        }
        throw error;
    }
}

/**
 * Save embeddings to cache file
 */
async function saveEmbeddingsCache(data) {
    await fs.writeFile(EMBEDDINGS_PATH, JSON.stringify(data), 'utf8');
}

/**
 * Check if cache is valid (same products)
 */
function isCacheValid(cache, products) {
    if (!cache || !cache.productIds || !cache.embeddings) {
        return false;
    }

    // Check if product IDs match
    const currentIds = products.map(p => p.id).sort();
    const cachedIds = cache.productIds.sort();

    if (currentIds.length !== cachedIds.length) {
        return false;
    }

    for (let i = 0; i < currentIds.length; i++) {
        if (currentIds[i] !== cachedIds[i]) {
            return false;
        }
    }

    return true;
}

/**
 * Initialize embeddings for all products
 * Loads from cache if available, otherwise generates new embeddings
 */
async function initializeEmbeddings(products) {
    if (isInitialized) return;

    console.log(`[VectorStore] Initializing embeddings for ${products.length} products...`);

    // Try to load from cache
    const cache = await loadEmbeddingsCache();

    if (isCacheValid(cache, products)) {
        console.log('[VectorStore] Loading embeddings from cache...');
        productEmbeddings = cache.embeddings.map((embedding, idx) => ({
            id: cache.productIds[idx],
            name: products.find(p => p.id === cache.productIds[idx])?.name,
            embedding,
            product: products.find(p => p.id === cache.productIds[idx])
        }));
        isInitialized = true;
        console.log(`[VectorStore] Loaded ${productEmbeddings.length} embeddings from cache`);
        return;
    }

    // Generate new embeddings
    console.log('[VectorStore] Cache miss or invalid, generating new embeddings...');

    const texts = products.map(getProductEmbeddingText);
    const embeddings = await generateEmbeddingsBatch(texts);

    productEmbeddings = products.map((product, idx) => ({
        id: product.id,
        name: product.name,
        embedding: embeddings[idx],
        product
    }));

    // Save to cache
    const cacheData = {
        productIds: products.map(p => p.id),
        embeddings,
        createdAt: new Date().toISOString(),
        model: EMBEDDING_MODEL
    };
    await saveEmbeddingsCache(cacheData);

    isInitialized = true;
    console.log(`[VectorStore] Generated and cached ${productEmbeddings.length} embeddings`);
}

/**
 * Search products by semantic similarity
 * @param {string} query - User's search query
 * @param {number} topK - Number of results to return (default: 5)
 * @returns {Promise<Array>} Top K products sorted by similarity
 */
async function vectorSearch(query, topK = 5) {
    if (!isInitialized) {
        throw new Error('VectorStore not initialized. Call initializeEmbeddings first.');
    }

    console.log(`[VectorStore] Vector search for "${query}"`);
    const startTime = Date.now();

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Calculate similarity with all products
    const scored = productEmbeddings.map(item => ({
        product: item.product,
        similarity: cosineSimilarity(queryEmbedding, item.embedding)
    }));

    // Sort by similarity (descending) and take top K
    scored.sort((a, b) => b.similarity - a.similarity);
    const results = scored.slice(0, topK).map(s => s.product);

    const elapsed = Date.now() - startTime;
    console.log(`[VectorStore] Found ${results.length} results in ${elapsed}ms`);

    return results;
}

/**
 * Reset the vector store (for testing)
 */
function reset() {
    productEmbeddings = [];
    isInitialized = false;
    openai = null;
}

/**
 * Check if initialized (for testing)
 */
function getIsInitialized() {
    return isInitialized;
}

module.exports = {
    initializeEmbeddings,
    vectorSearch,
    reset,
    getIsInitialized,
    cosineSimilarity,
    EMBEDDINGS_PATH
};
