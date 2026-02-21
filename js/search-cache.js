// Toutes les données sont stockées en mémoire uniquement

class WebSearchCache {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 200;
        this.cacheExpiry = 7 * 24 * 60 * 60 * 1000;
    }
    createKey(query, page, sort = '', configSignature = 'default') {
        return `web:${query.toLowerCase().trim()}:${page}:${sort}:${configSignature}`;
    }
    cleanExpiredEntries() {
        const now = Date.now();
        for (const [key, value] of this.cache) {
            if (now - value.timestamp > this.cacheExpiry) this.cache.delete(key);
        }
    }
    get(query, page, sort = '', configSignature) {
        this.cleanExpiredEntries();
        const entry = this.cache.get(this.createKey(query, page, sort, configSignature));
        if (!entry || Date.now() - entry.timestamp > this.cacheExpiry) return null;
        return entry.data;
    }
    set(query, page, data, sort = '', configSignature) {
        if (this.cache.size >= this.maxCacheSize) this.cache.delete(this.cache.keys().next().value);
        this.cache.set(this.createKey(query, page, sort, configSignature), { data, timestamp: Date.now() });
    }
    getStats() { return { size: this.cache.size, maxSize: this.maxCacheSize }; }
    clear() { this.cache.clear(); }
}

class ImageSearchCache {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.cacheExpiry = 7 * 24 * 60 * 60 * 1000;
        this.enabled = true;
    }
    createKey(query, page, configSignature = 'default') {
        return `images:${query.toLowerCase().trim()}:${page}:${configSignature}`;
    }
    cleanExpiredEntries() {
        if (!this.enabled) return;
        const now = Date.now();
        for (const [key, value] of this.cache) {
            if (now - value.timestamp > this.cacheExpiry) this.cache.delete(key);
        }
    }
    get(query, page, configSignature) {
        if (!this.enabled) return null;
        this.cleanExpiredEntries();
        const entry = this.cache.get(this.createKey(query, page, configSignature));
        if (!entry || Date.now() - entry.timestamp > this.cacheExpiry) return null;
        return entry.data;
    }
    set(query, page, data, configSignature) {
        if (!this.enabled) return;
        if (this.cache.size >= this.maxCacheSize) this.cache.delete(this.cache.keys().next().value);
        this.cache.set(this.createKey(query, page, configSignature), { data, timestamp: Date.now() });
    }
    getStats() { return { size: this.enabled ? this.cache.size : 0, maxSize: this.maxCacheSize, enabled: this.enabled }; }
    clear() { this.cache.clear(); }
    enable() { this.enabled = true; }
    disable() { this.enabled = false; this.clear(); }
}

class ApiQuotaManager {
    constructor() {
        this.dailyLimit = 90;
        this.todayUsage = 0;
        this.lastResetDate = new Date().toDateString();
    }
    checkReset() {
        const today = new Date().toDateString();
        if (this.lastResetDate !== today) {
            this.todayUsage = 0;
            this.lastResetDate = today;
        }
    }
    recordRequest() {
        this.checkReset();
        this.todayUsage++;
    }
    getUsage() {
        this.checkReset();
        return { used: this.todayUsage, limit: this.dailyLimit, remaining: this.dailyLimit - this.todayUsage };
    }
}
