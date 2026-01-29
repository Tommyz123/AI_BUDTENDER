/**
 * LRU Cache with TTL support
 */
class LRUCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.ttl = options.ttl || 0; // TTL in milliseconds, 0 = no expiration
        this.cache = new Map();
    }

    /**
     * Get a value from the cache
     * @param {string} key
     * @returns {*} value or undefined if not found/expired
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return undefined;
        }

        // Check TTL expiration
        if (this.ttl > 0 && Date.now() > entry.expiry) {
            this.cache.delete(key);
            return undefined;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.value;
    }

    /**
     * Set a value in the cache
     * @param {string} key
     * @param {*} value
     * @param {number} customTtl - Optional custom TTL for this entry
     */
    set(key, value, customTtl) {
        // Delete existing entry if present
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Evict oldest entries if at capacity
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        const ttlToUse = customTtl !== undefined ? customTtl : this.ttl;
        const entry = {
            value,
            expiry: ttlToUse > 0 ? Date.now() + ttlToUse : Infinity
        };

        this.cache.set(key, entry);
    }

    /**
     * Check if key exists and is not expired
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return false;
        }

        if (this.ttl > 0 && Date.now() > entry.expiry) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete a key from the cache
     * @param {string} key
     * @returns {boolean}
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * Clear all entries
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get current cache size
     * @returns {number}
     */
    get size() {
        return this.cache.size;
    }

    /**
     * Clean up expired entries
     * @returns {number} Number of entries removed
     */
    prune() {
        if (this.ttl === 0) return 0;

        let removed = 0;
        const now = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                this.cache.delete(key);
                removed++;
            }
        }

        return removed;
    }
}

module.exports = { LRUCache };
