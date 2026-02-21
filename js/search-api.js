// ==================== SYSTÈME GÉNÉRIQUE D'API ====================

/**
 * HOTFIX for Vikidia image URLs.
 * The API returns insecure (HTTP) URLs pointing to download.vikidia.org.
 * These URLs are automatically upgraded to HTTPS by the browser, but the server
 * returns a 403 Forbidden error, likely due to hotlink protection.
 * The correct, working URLs are on the main language-specific domain (e.g., fr.vikidia.org)
 * under the /w/images/ path.
 * @param {string} url The original image URL.
 * @returns {string} The corrected HTTPS URL or the original URL if no fix was needed.
 */
function fixVikidiaImageUrl(url) {
    if (typeof url !== 'string' || !url.includes('download.vikidia.org')) {
        return url;
    }
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'download.vikidia.org') {
            const pathParts = urlObj.pathname.split('/');
            if (pathParts[1] === 'vikidia' && pathParts[3] === 'images') {
                const lang = pathParts[2];
                const imagePath = pathParts.slice(4).join('/');
                return `https://${lang}.vikidia.org/w/images/${imagePath}`;
            }
        }
    } catch (e) {
        console.warn('Could not parse URL for Vikidia fix:', url, e);
    }
    return url;
}


class GenericApiSource {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.type = config.type;
        this.enabled = config.enabled !== false;
        this.weight = config.weight || 0.5;
        this.config = config;
    }

    async search(query, lang = 'fr', options = {}) {
        if (!this.enabled || this.config.supportsWeb === false) return [];

        try {
            switch (this.type) {
                case 'mediawiki':
                    return await this.searchMediaWiki(query, lang, options);
                case 'meilisearch':
                    return await this.searchMeiliSearch(query, lang, options);
                case 'custom':
                    return await this.searchCustom(query, lang, options);
                default:
                    console.warn(`Type d\'API non supporté: ${this.type}`);
                    return [];
            }
        } catch (error) {
            console.error(`Erreur ${this.name}:`, error);
            return [];
        }
    }

    async searchMediaWiki(query, lang, options) {
        const apiUrl = this.config.apiUrl.replace('{lang}', lang);
        const baseUrl = this.config.baseUrl.replace('{lang}', lang);
        const limit = options.limit || this.config.resultsLimit || 5;

        const searchUrl = new URL(apiUrl);
        const searchParams = {
            action: 'query',
            format: 'json',
            list: 'search',
            srsearch: query,
            srprop: 'snippet|titlesnippet',
            srlimit: limit,
            origin: '*',
            ...this.config.searchParams
        };
        Object.entries(searchParams).forEach(([k, v]) => searchUrl.searchParams.append(k, v));

        const searchData = await (await fetch(searchUrl)).json();
        if (!searchData.query?.search?.length) return [];

        let thumbMap = {};
        if (this.config.fetchThumbnails) {
            const titles = searchData.query.search.map(i => i.title).join('|');
            const thumbUrl = new URL(apiUrl);
            const thumbParams = {
                action: 'query',
                format: 'json',
                prop: 'pageimages',
                piprop: 'thumbnail',
                pithumbsize: this.config.thumbnailSize || 200,
                titles,
                origin: '*'
            };
            Object.entries(thumbParams).forEach(([k, v]) => thumbUrl.searchParams.append(k, v));

            const thumbData = await (await fetch(thumbUrl)).json();
            if (thumbData.query?.pages) {
                Object.values(thumbData.query.pages).forEach(p => {
                    if (p.thumbnail) thumbMap[p.title] = fixVikidiaImageUrl(p.thumbnail.source);
                });
            }
        }

        return searchData.query.search.map(item => {
            const urlPath = this.config.articlePath || '/wiki/';
            const articleUrl = `${baseUrl}${urlPath}${encodeURIComponent(item.title.replace(/ /g, '_'))}`;

            const result = {
                title: item.title,
                link: articleUrl,
                displayLink: new URL(baseUrl).hostname,
                snippet: item.snippet.replace(/<\/?span[^>]*>/g, ''),
                htmlSnippet: item.snippet,
                source: this.name,
                weight: this.weight
            };

            if (thumbMap[item.title]) {
                result.pagemap = { cse_thumbnail: [{ src: thumbMap[item.title] }] };
            }

            return result;
        });
    }

    async searchMeiliSearch(query, lang, options) {
        const limit = options.limit || this.config.resultsLimit || 5;

        const payload = {
            q: query,
            limit,
            attributesToRetrieve: this.config.attributesToRetrieve || ['*', '_formatted'],
            attributesToHighlight: this.config.attributesToHighlight || ['title', 'content'],
            attributesToCrop: this.config.attributesToCrop || ['content'],
            cropLength: this.config.cropLength || 30,
            cropMarker: '...',
            highlightPreTag: '<span class="searchmatch">',
            highlightPostTag: '</span>',
            matchingStrategy: this.config.matchingStrategy || 'last',
            ...(this.config.filter && { filter: this.config.filter.replace('{lang}', lang) })
        };

        if (this.config.semanticSearch && this.config.semanticSearch.enabled) {
            payload.hybrid = {
                semanticRatio: this.config.semanticSearch.semanticRatio || 0.75,
                embedder: 'default'
            };
            console.log(`⚡️ Recherche sémantique activée pour ${this.name} (ratio: ${payload.hybrid.semanticRatio})`);
        }

        const res = await fetch(`${this.config.apiUrl}/indexes/${this.config.indexName}/search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) return [];
        const data = await res.json();
        if (!data.hits?.length) return [];

        return data.hits.map(hit => {
            const content = hit._formatted?.content || hit._formatted?.excerpt || hit.content || '';
            const result = {
                title: hit._formatted?.title || hit.title,
                link: hit.url,
                displayLink: new URL(hit.url).hostname,
                snippet: content.replace(/<\/?span[^>]*>/g, ''),
                htmlSnippet: content,
                source: this.name,
                weight: this.weight
            };

            if (hit.images?.[0]?.url) {
                result.pagemap = { cse_thumbnail: [{ src: fixVikidiaImageUrl(hit.images[0].url) }] };
            }

            return result;
        });
    }

    async searchCustom(query, lang, options) {
        let url = this.config.apiUrl
            .replace('{query}', encodeURIComponent(query))
            .replace('{lang}', lang)
            .replace('{limit}', options.limit || this.config.resultsLimit || 5);

        // Ajoute le paramètre use_hybrid si configuré
        const useHybrid = this.config.use_hybrid || false;
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}use_hybrid=${useHybrid}`;

        const requestOptions = {
            method: this.config.method || 'GET',
            headers: this.config.headers || {}
        };

        if (this.config.method === 'POST' && this.config.body) {
            requestOptions.body = JSON.stringify(
                this.config.body.replace('{query}', query).replace('{lang}', lang)
            );
        }

        const res = await fetch(url, requestOptions);
        if (!res.ok) return [];

        const data = await res.json();

        if (this.config.transformer && typeof this.config.transformer === 'function') {
            return this.config.transformer(data, this.name, this.weight);
        }

        const items = this.config.resultsPath ?
            this.config.resultsPath.split('.').reduce((obj, key) => obj?.[key], data) :
            data;

        if (!Array.isArray(items)) return [];

        return items.map(item => {
            // Clean wiki markup from excerpt/snippet
            let cleanedSnippet = (item[this.config.snippetField || 'snippet'] || '')
                // Remove wiki templates like {{Template|...}} and {{Unité|value|unit}}
                .replace(/\{\{[^}]*\}\}/g, '')
                // Remove wiki links [[Link|Text]] -> Text or [[Text]] -> Text
                .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
                // Remove bold/italic markup
                .replace(/'''([^']+)'''/g, '$1')
                .replace(/''([^']+)''/g, '$1')
                // Remove file references and thumbnails
                .replace(/\[\[(?:Fichier|File|Image):[^\]]+\]\]/gi, '')
                .replace(/thumb\|[^\]]+/g, '')
                // Remove HTML tags (like <span>)
                .replace(/<[^>]+>/g, '')
                // Remove wiki section markers
                .replace(/={2,}\s*([^=]+)\s*={2,}/g, '$1')
                // Remove remaining brackets from incomplete markup
                .replace(/\[\[|\]\]|\[|\]/g, '')
                // Remove pipe characters that are leftover from templates
                .replace(/\|\s*/g, ' ')
                // Clean up whitespace
                .trim().replace(/\s+/g, ' ');

            // If snippet is too short or empty after cleaning, provide a better fallback
            if (cleanedSnippet.length < 20) {
                const title = item[this.config.titleField || 'title'];
                const siteName = item.site || 'le site';
                cleanedSnippet = `Découvrez l'article "${title}" sur ${siteName}.`;
            }

            // Limit length if too long
            if (cleanedSnippet.length > 300) {
                cleanedSnippet = cleanedSnippet.substring(0, 297) + '...';
            }

            const result = {
                title: item[this.config.titleField || 'title'],
                link: item[this.config.linkField || 'url'],
                displayLink: item.site || new URL(item[this.config.linkField || 'url']).hostname,
                snippet: cleanedSnippet,
                htmlSnippet: cleanedSnippet,
                source: this.name,
                weight: item.score || this.weight
            };

            // Handle images if present (from backend API)
            if (item.images && item.images.length > 0 && item.images[0].url) {
                result.pagemap = {
                    cse_thumbnail: [{ src: fixVikidiaImageUrl(item.images[0].url) }]
                };
            }

            return result;
        });
    }

    async searchImages(query, options = {}) {
        if (!this.enabled || !this.config.supportsImages) return [];

        try {
            if (this.type === 'mediawiki' && this.config.imageSearch) {
                return await this.searchMediaWikiImages(query, options);
            } else if (this.type === 'meilisearch' && this.config.imageSearch) {
                return await this.searchMeiliSearchImages(query, options);
            }
            return [];
        } catch (error) {
            console.error(`Erreur recherche images ${this.name}:`, error);
            return [];
        }
    }

    async searchMediaWikiImages(query, options) {
        const apiUrl = this.config.apiUrl.replace('{lang}', options.lang || 'fr');
        const baseUrl = this.config.baseUrl.replace('{lang}', options.lang || 'fr');

        let finalQuery = query;
        if (this.config.imageSearch.excludeCategories) {
            const exclusions = this.config.imageSearch.excludeCategories
                .map(c => `-incategory:"${c}"`)
                .join(' ');
            finalQuery = `${query} ${exclusions}`;
        }

        const searchUrl = new URL(apiUrl);
        const searchParams = {
            action: 'query',
            format: 'json',
            list: 'search',
            srsearch: finalQuery,
            srnamespace: 6,
            srlimit: options.limit || 10,
            srwhat: 'text',
            origin: '*'
        };
        Object.entries(searchParams).forEach(([k, v]) => searchUrl.searchParams.append(k, v));

        const searchData = await (await fetch(searchUrl)).json();
        if (!searchData.query?.search?.length) return [];

        const titles = searchData.query.search.map(i => i.title).join('|');
        const infoUrl = new URL(apiUrl);
        const infoParams = {
            action: 'query',
            format: 'json',
            prop: 'imageinfo',
            iiprop: 'url|size|extmetadata',
            iiurlwidth: this.config.thumbnailSize || 200,
            titles,
            origin: '*'
        };
        Object.entries(infoParams).forEach(([k, v]) => infoUrl.searchParams.append(k, v));

        const infoData = await (await fetch(infoUrl)).json();
        if (!infoData.query?.pages) return [];

        return Object.values(infoData.query.pages)
            .filter(p => p.imageinfo?.[0])
            .map(p => {
                const img = p.imageinfo[0];
                return {
                    title: p.title.replace('File:', '').replace(/\.[^/.]+$/, ""),
                    link: fixVikidiaImageUrl(img.url),
                    displayLink: new URL(baseUrl).hostname,
                    source: this.name,
                    weight: this.weight,
                    image: {
                        contextLink: img.descriptionurl,
                        thumbnailLink: fixVikidiaImageUrl(img.thumburl),
                        width: img.thumbwidth,
                        height: img.thumbheight
                    }
                };
            });
    }

    async searchMeiliSearchImages(query, options) {
        const res = await fetch(`${this.config.apiUrl}/indexes/${this.config.indexName}/search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: query, limit: options.limit || 10 })
        });

        if (!res.ok) return [];
        const data = await res.json();

        return (data.hits || [])
            .filter(h => h.images?.length > 0)
            .map(h => {
                const img = h.images[0];
                return {
                    title: h.title,
                    link: fixVikidiaImageUrl(img.url),
                    displayLink: new URL(h.url).hostname,
                    source: this.name,
                    weight: this.weight,
                    image: {
                        contextLink: h.url,
                        thumbnailLink: fixVikidiaImageUrl(img.url),
                        width: img.width || 400,
                        height: img.height || 300
                    }
                };
            });
    }
}

class ApiSourceManager {
    constructor() {
        this.sources = new Map();
        console.log("search.js: 🏗️ ApiSourceManager: constructeur appelé.");
        this.loadConfiguration();
    }

    loadConfiguration() {
        if (typeof CONFIG !== 'undefined' && CONFIG.API_SOURCES) {
            console.log(`search.js: ⚙️ ApiSourceManager: Chargement de ${CONFIG.API_SOURCES.length} source(s) depuis CONFIG.API_SOURCES.`);
            this.loadFromConfig(CONFIG.API_SOURCES);
            return;
        }
        console.log("search.js: ⚠️ ApiSourceManager: CONFIG.API_SOURCES non trouvé. Chargement de la configuration par défaut.");
        this.loadDefaultConfiguration();
    }

    loadFromConfig(apiSourcesConfig) {
        apiSourcesConfig.forEach(sourceConfig => {
            const source = new GenericApiSource(sourceConfig);
            this.sources.set(source.id, source);
        });
    }

    loadDefaultConfiguration() {
        const defaultSources = [
            {
                id: 'vikidia',
                name: 'Vikidia',
                type: 'mediawiki',
                enabled: true,
                weight: 0.5,
                apiUrl: 'https://{lang}.vikidia.org/w/api.php',
                baseUrl: 'https://{lang}.vikidia.org/wiki/',
                fetchThumbnails: true,
                thumbnailSize: 200,
                resultsLimit: 5
            },
            {
                id: 'wikipedia',
                name: 'Wikipedia',
                type: 'mediawiki',
                enabled: true,
                weight: 0.5,
                apiUrl: 'https://{lang}.wikipedia.org/w/api.php',
                baseUrl: 'https://{lang}.wikipedia.org/wiki/',
                fetchThumbnails: true,
                thumbnailSize: 200,
                resultsLimit: 5
            }
        ];

        defaultSources.forEach(config => {
            const source = new GenericApiSource(config);
            this.sources.set(source.id, source);
        });
    }

    getSource(id) {
        return this.sources.get(id);
    }

    getActiveSources() {
        return Array.from(this.sources.values()).filter(s => s.enabled);
    }

    getActiveImageSources() {
        return Array.from(this.sources.values())
            .filter(s => s.enabled && s.config.supportsImages);
    }

    async searchAll(query, lang = 'fr', options = {}) {
        const sources = this.getActiveSources();
        const results = await Promise.all(
            sources.map(source => source.search(query, lang, options))
        );
        return results.flat();
    }

    async searchAllImages(query, lang = 'fr', options = {}) {
        const sources = this.getActiveImageSources();
        const results = await Promise.all(
            sources.map(source => source.searchImages(query, { ...options, lang }))
        );
        return results.flat();
    }

    getConfigSignature() {
        return Array.from(this.sources.values())
            .filter(s => s.enabled)
            .map(s => `${s.id}:${s.config.weight || 1}`)
            .join('|');
    }

    getImageConfigSignature() {
        return Array.from(this.sources.values())
            .filter(s => s.enabled && s.config.supportsImages)
            .map(s => `${s.id}:${s.config.weight || 1}`)
            .join('|');
    }
}
