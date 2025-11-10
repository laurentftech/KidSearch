(async function() {
    'use strict';

    console.log("loader.js: Initializing configuration loader (v2)...");

    /**
     * Dynamically loads a script and returns a promise.
     * @param {string} url The URL of the script to load.
     * @returns {Promise<void>}
     */
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => {
                console.log(`✅ Script loaded: ${url}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`❌ Failed to load script: ${url}`);
                reject(new Error(`Script load error for ${url}`));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Fetches a JSON configuration file.
     * @param {string} url The URL of the JSON file.
     * @returns {Promise<object>}
     */
    async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url} (status: ${response.status})`);
        }
        return response.json();
    }

    try {
        // 1. Load base configuration (config.js or config.demo.js)
        try {
            const configRes = await fetch('config/config.js', { method: 'HEAD' });
            if (configRes.ok) {
                await loadScript('config/config.js');
            } else {
                console.warn("⚠️ config.js not found. Falling back to config.demo.js.");
                await loadScript('config/config.demo.js');
            }
        } catch (e) {
            console.warn("⚠️ Network error or local execution. Falling back to config.demo.js.", e);
            await loadScript('config/config.demo.js');
        }

        if (typeof window.CONFIG === 'undefined') {
            console.error("❌ window.CONFIG is not defined after loading config script. Using empty fallback.");
            window.CONFIG = {};
        }

        // 2. Load API sources configuration
        try {
            const apiConfig = await fetchJson('config/config-api-sources.json');
            window.CONFIG.API_SOURCES = apiConfig.apiSources || [];
            console.log(`✅ API sources loaded from config/config-api-sources.json`);
        } catch (e) {
            console.warn(`⚠️ Could not load config-api-sources.json. Falling back to example file.`, e.message);
            try {
                const apiConfig = await fetchJson('config/config-api-sources-example.json');
                window.CONFIG.API_SOURCES = apiConfig.apiSources || [];
                console.log(`✅ API sources loaded from config/config-api-sources-example.json`);
            } catch (e2) {
                console.error(`❌ Failed to load any API source configuration. Will use migration fallback.`, e2.message);
                window.CONFIG.API_SOURCES = [];
            }
        }

        // 3. If API_SOURCES is empty, try to migrate from old config structure as a fallback
        if (!window.CONFIG.API_SOURCES || window.CONFIG.API_SOURCES.length === 0) {
            console.log("loader.js: ⚠️ API_SOURCES is empty, attempting to migrate from old config format.");
            const migratedSources = [];
            
            if (window.CONFIG.VIKIDIA_SEARCH_CONFIG?.ENABLED) {
                migratedSources.push({
                    id: 'vikidia', name: 'Vikidia', type: 'mediawiki', enabled: true,
                    weight: window.CONFIG.VIKIDIA_SEARCH_CONFIG.WEIGHT || 0.5,
                    apiUrl: window.CONFIG.VIKIDIA_SEARCH_CONFIG.API_URL,
                    baseUrl: 'https://{lang}.vikidia.org', articlePath: '/wiki/',
                    fetchThumbnails: true, thumbnailSize: 200, resultsLimit: 5,
                    excludeFromGoogle: true, excludeDomains: ['vikidia.org'], supportsImages: false
                });
            }
            if (window.CONFIG.WIKIPEDIA_SEARCH_CONFIG?.ENABLED) {
                migratedSources.push({
                    id: 'wikipedia', name: 'Wikipedia', type: 'mediawiki', enabled: true,
                    weight: window.CONFIG.WIKIPEDIA_SEARCH_CONFIG.WEIGHT || 0.5,
                    apiUrl: window.CONFIG.WIKIPEDIA_SEARCH_CONFIG.API_URL,
                    baseUrl: 'https://{lang}.wikipedia.org', articlePath: '/wiki/',
                    fetchThumbnails: true, thumbnailSize: 200, resultsLimit: 5,
                    excludeFromGoogle: true, excludeDomains: ['wikipedia.org'], supportsImages: false
                });
            }
            if (window.CONFIG.COMMONS_IMAGE_SEARCH_CONFIG?.ENABLED) {
                 migratedSources.push({
                    id: 'wikimedia-commons', name: 'Wikimedia Commons', type: 'mediawiki', enabled: true,
                    weight: window.CONFIG.COMMONS_IMAGE_SEARCH_CONFIG.WEIGHT || 0.7,
                    apiUrl: window.CONFIG.COMMONS_IMAGE_SEARCH_CONFIG.API_URL,
                    baseUrl: 'https://commons.wikimedia.org', thumbnailSize: 400, resultsLimit: 10,
                    excludeFromGoogle: true, excludeDomains: ['wikimedia.org', 'commons.wikimedia.org'],
                    supportsImages: true, imageSearch: { enabled: true, excludeCategories: ["Nudity in art", "Erotic art", "Sexual activity", "Violence", "Deaths", "Human corpses"] }
                });
            }
            if (window.CONFIG.MEILISEARCH_CONFIG?.ENABLED) {
                migratedSources.push({
                    id: 'meilisearch-main', name: window.CONFIG.MEILISEARCH_CONFIG.SOURCE_NAME || 'MeiliSearch',
                    type: 'meilisearch', enabled: true, weight: window.CONFIG.MEILISEARCH_CONFIG.WEIGHT || 0.6,
                    apiUrl: window.CONFIG.MEILISEARCH_CONFIG.API_URL, apiKey: window.CONFIG.MEILISEARCH_CONFIG.API_KEY,
                    indexName: window.CONFIG.MEILISEARCH_CONFIG.INDEX_NAME, resultsLimit: 5,
                    excludeFromGoogle: true, excludeDomains: window.CONFIG.MEILISEARCH_CONFIG.BASE_URLS || [],
                    supportsImages: true, imageSearch: { enabled: true }
                });
            }

            window.CONFIG.API_SOURCES = migratedSources;
            if (migratedSources.length > 0) {
                console.log(`✅ Migrated ${migratedSources.length} sources from old config format.`);
            } else {
                console.warn("⚠️ No sources to migrate. Search may not return results from APIs.");
            }
        }

    } catch (error) {
        console.error("❌ A critical error occurred during configuration loading:", error);
        if (typeof window.CONFIG === 'undefined') window.CONFIG = {};
        if (typeof window.CONFIG.API_SOURCES === 'undefined') window.CONFIG.API_SOURCES = [];
    } finally {
        // 4. Dispatch the event to signal that configuration is ready
        console.log("loader.js: 🚀 Dispatching 'apiConfigLoaded' event.");
        
        // DEBUG: Log the final Knowledge Panel configuration
        if (window.CONFIG?.KNOWLEDGE_PANEL_CONFIG) {
            console.log("🔍 FINAL KNOWLEDGE PANEL CONFIG:", JSON.stringify(window.CONFIG.KNOWLEDGE_PANEL_CONFIG, null, 2));
        } else {
            console.log("🔍 KNOWLEDGE_PANEL_CONFIG is not defined.");
        }

        window.apiConfigLoaded = true; // Set global flag for compatibility
        window.dispatchEvent(new CustomEvent('apiConfigLoaded', {
            detail: { sources: window.CONFIG.API_SOURCES || [] }
        }));
    }
})();
