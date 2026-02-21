// ==================== INITIALISATION ====================

function initializeSearch() {
    console.log("search.js: ✨ Initialisation du moteur de recherche...");
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearButton');
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    const loadingEl = document.getElementById('loadingIndicator');
    const resultsContainer = document.getElementById('resultsContainer');
    const statsEl = document.getElementById('searchStats');
    const paginationEl = document.getElementById('pagination');
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalSource = document.getElementById('modalSource');
    const modalDimensions = document.getElementById('modalDimensions');
    const webTab = document.getElementById('webTab');
    const imagesTab = document.getElementById('imagesTab');
    const toolsContainer = document.getElementById('toolsContainer');
    const toolsButton = document.getElementById('toolsButton');

    const RESULTS_PER_PAGE = 10;
    let currentSearchType = 'web', currentQuery = '', currentSort = '', currentPage = 1;
    const webCache = new WebSearchCache(), imageCache = new ImageSearchCache(), quotaManager = new ApiQuotaManager();
    
    const apiManager = new ApiSourceManager();

    if (!searchInput) { console.error('search.js: #searchInput introuvable'); return; }

    let suggestions = [], selectedIndex = -1, inputDebounceTimer = null, currentSuggestionsLang = navigator.language.startsWith('en') ? 'en' : 'fr';

    function loadSuggestions() {
        const lang = i18n.getLang();
        if (currentSuggestionsLang === lang && suggestions.length > 0) return;
        currentSuggestionsLang = lang;
        fetch(lang === 'en' ? 'config/suggestions-en.json' : 'config/suggestions.json')
            .then(r => r.json())
            .then(j => { suggestions = j.suggestions || []; })
            .catch(() => { suggestions = lang === 'en' ? ["animals", "dinosaurs", "planets"] : ["animaux", "planètes", "dinosaures"]; });
    }
    loadSuggestions();

    function updateUrl(query, type = currentSearchType, page = 1, sort = currentSort) {
        try {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('q', query);
            newUrl.searchParams.set('type', type);
            if (page > 1) newUrl.searchParams.set('p', page); else newUrl.searchParams.delete('p');
            if (sort) newUrl.searchParams.set('sort', sort); else newUrl.searchParams.delete('sort');
            window.history.pushState({}, '', newUrl);
        } catch (e) {}
    }

    function detectQueryLanguage(query) {
        const lq = query.toLowerCase();
        if (/[àâçéèêëîïôûùüÿœæ]/i.test(lq) || /\b(le|la|les|un|une|des)\b/i.test(lq)) return 'fr';
        if (/\b(the|and|for|what|who|are)\b/i.test(lq)) return 'en';
        return null;
    }

    function isGoogleCseEnabled() {
        // Vérifie si Google CSE est configuré et activé
        if (typeof CONFIG === 'undefined') return false;

        // Vérifie le flag d'activation explicite
        if (CONFIG.GOOGLE_CSE_ENABLED === false) return false;

        // Vérifie que les credentials sont présents et non vides
        const hasApiKey = CONFIG.GOOGLE_API_KEY && CONFIG.GOOGLE_API_KEY.trim() !== '' && CONFIG.GOOGLE_API_KEY !== 'VOTRE_API_KEY_ICI';
        const hasCseId = CONFIG.GOOGLE_CSE_ID && CONFIG.GOOGLE_CSE_ID.trim() !== '' && CONFIG.GOOGLE_CSE_ID !== 'VOTRE_ID_CSE_ICI';

        return hasApiKey && hasCseId;
    }

    function buildGoogleCseApiUrl(query, type, page, sort) {
        const url = new URL('https://www.googleapis.com/customsearch/v1');
        let finalQuery = query;

        if (type === 'web') {
            const activeSources = apiManager.getActiveSources();
            activeSources.forEach(source => {
                if (source.config.excludeFromGoogle !== false) {
                    const domains = source.config.excludeDomains || [new URL(source.config.baseUrl).hostname];
                    domains.forEach(domain => {
                        finalQuery += ` -site:${domain}`;
                    });
                }
            });
        } else if (type === 'images') {
            const activeImageSources = apiManager.getActiveImageSources();
            activeImageSources.forEach(source => {
                if (source.config.excludeFromGoogle !== false) {
                    const domains = source.config.excludeDomains || [new URL(source.config.baseUrl).hostname];
                    domains.forEach(domain => {
                        finalQuery += ` -site:${domain}`;
                    });
                }
            });
        }

        url.searchParams.set('q', finalQuery);
        url.searchParams.set('key', CONFIG.GOOGLE_API_KEY);
        url.searchParams.set('cx', CONFIG.GOOGLE_CSE_ID);
        url.searchParams.set('start', String((page - 1) * RESULTS_PER_PAGE + 1));
        url.searchParams.set('num', String(RESULTS_PER_PAGE));
        url.searchParams.set('safe', 'active');
        url.searchParams.set('filter', '1');
        if (sort) url.searchParams.set('sort', sort);
        if (type === 'images') url.searchParams.set('searchType', 'image');
        else { const lang = detectQueryLanguage(query); if (lang) url.searchParams.set('lr', `lang_${lang}`); }
        return url.toString();
    }

    function showLoading() { if (loadingEl) loadingEl.style.display = 'flex'; }
    function hideLoading() { if (loadingEl) loadingEl.style.display = 'none'; }

    function doSearch(e) {
        if (e) e.preventDefault();
        const q = searchInput.value.trim();
        if (!q) return;
        if (document.body.classList.contains('is-homepage')) {
            window.location.href = `results.html?q=${encodeURIComponent(q)}${new URLSearchParams(window.location.search).has('dev') ? '&dev=1' : ''}`;
            return;
        }
        if (document.body.classList.contains('is-resultspage')) {
            currentQuery = q;
            currentPage = 1;
            currentSort = '';
            performSearch(currentQuery, currentSearchType, currentPage, currentSort);
            document.title = `${currentQuery} - Search for Kids`;
            updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
        }
    }

    async function performSearch(query, type = 'web', page = 1) {
        if (!query) return;
        const cleanedQuery = query.split('?')[0].trim();
        if (!cleanedQuery) return;

        showLoading();
        resultsContainer.innerHTML = '';
        statsEl.innerHTML = '';
        paginationEl.innerHTML = '';

        if (typeof tryDisplayKnowledgePanel === 'function' && type === 'web' && page === 1) {
            tryDisplayKnowledgePanel(cleanedQuery);
        }

        const configSignature = type === 'web' ? apiManager.getConfigSignature() : apiManager.getImageConfigSignature();
        let cachedData = type === 'web' ? webCache.get(cleanedQuery, page, currentSort, configSignature) : imageCache.get(cleanedQuery, page, configSignature);

        if (cachedData) {
            hideLoading();
            displayResults(cachedData, type, cleanedQuery, page);
            updateQuotaDisplay();
            return;
        }

        try {
            let combinedData, googleResponse;
            const lang = detectQueryLanguage(cleanedQuery) || i18n.getLang();
            const googleEnabled = isGoogleCseEnabled();

            if (type === 'web') {
                let googlePromise;
                if (googleEnabled) {
                    googlePromise = fetch(buildGoogleCseApiUrl(cleanedQuery, type, page, currentSort))
                        .then(res => res.json())
                        .catch(err => {
                            console.warn("Erreur API Google", err);
                            return { error: err, items: [], searchInformation: {} };
                        });
                } else {
                    console.log("ℹ️ Google CSE désactivé, utilisation des sources alternatives uniquement");
                    googlePromise = Promise.resolve({ items: [], searchInformation: {} });
                }

                const secondaryResults = page === 1 ? await apiManager.searchAll(cleanedQuery, lang) : [];
                const googleResponse = await googlePromise;
                
                if (googleResponse.error) console.error("Erreur Google:", googleResponse.error.message);

                const mergedResults = mergeAndWeightResults(googleResponse.items || [], page === 1 ? [secondaryResults] : [], cleanedQuery, 'web');
                combinedData = {
                    items: mergedResults,
                    searchInformation: googleResponse.searchInformation || { totalResults: mergedResults.length.toString() },
                    googleItemsCount: (googleResponse.items || []).length,
                    hasMorePages: (googleResponse.items || []).length >= RESULTS_PER_PAGE || mergedResults.length >= RESULTS_PER_PAGE
                };
                webCache.set(cleanedQuery, page, combinedData, currentSort, configSignature);
            } else {
                let googlePromise;
                if (googleEnabled) {
                    googlePromise = fetch(buildGoogleCseApiUrl(cleanedQuery, type, page, currentSort))
                        .then(res => res.json())
                        .catch(err => {
                            console.warn("Erreur Google Images", err);
                            return { error: err, items: [], searchInformation: {} };
                        });
                } else {
                    console.log("ℹ️ Google CSE désactivé pour les images, utilisation des sources alternatives uniquement");
                    googlePromise = Promise.resolve({ items: [], searchInformation: {} });
                }

                const secondaryResults = page === 1 ? await apiManager.searchAllImages(cleanedQuery, lang) : [];
                const googleResponse = await googlePromise;
                
                if (googleResponse.error) console.error("Erreur Google Images:", googleResponse.error.message);

                const mergedResults = mergeAndWeightResults(googleResponse.items || [], page === 1 ? [secondaryResults] : [], cleanedQuery, 'images');
                combinedData = {
                    items: mergedResults,
                    searchInformation: googleResponse.searchInformation || { totalResults: mergedResults.length.toString() },
                    googleItemsCount: (googleResponse.items || []).length,
                    hasMorePages: (googleResponse.items || []).length >= RESULTS_PER_PAGE || mergedResults.length >= RESULTS_PER_PAGE
                };
                imageCache.set(cleanedQuery, page, combinedData, configSignature);
            }

            hideLoading();
            // Record quota usage only if Google API was enabled and didn't return an error object
            if (googleEnabled && googleResponse && !googleResponse.error) {
                quotaManager.recordRequest();
            }
            updateQuotaDisplay();
            displayResults(combinedData, type, cleanedQuery, page);
        } catch (err) {
            hideLoading();
            const msg = i18n.get('errorKidFriendly');
            resultsContainer.innerHTML = `
        <div style="padding:2rem;text-align:center;color:#70757a;">
            <p>${msg}</p>
        </div>`;
            console.error('performSearch error', err);
        }
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>"'`=\/]/g, function(s) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
                '`': '&#96;',
                '=': '&#61;',
                '/': '&#47;'
            })[s];
        });
    }

    function displayResults(data, type, query, page) {
        statsEl.textContent = '';
        const totalResults = data.items?.length || 0;
        if (toolsContainer) toolsContainer.style.display = (type === 'web' && totalResults > 0) ? 'flex' : 'none';

        if (!data.items || data.items.length === 0) {
            const escapedQuery = escapeHTML(query);
            const noResultsMsg = i18n.get(type === 'images' ? 'noImages' : 'noResults') + ` "${escapedQuery}"`;
            const suggestionsMsg = i18n.get('noResultsSuggestions');
            resultsContainer.innerHTML = `<div style="padding:2rem;text-align:center;color:#70757a;"><p style="font-size:1.2em;margin-bottom:16px;">${noResultsMsg}</p><ul style="list-style:none;padding:0;font-size:0.9em;color:#5f6368;">${suggestionsMsg.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
            createPagination(totalResults, page, data);
            return;
        }

        resultsContainer.classList.toggle('grid', type === 'images');
        data.items.forEach(item => {
            resultsContainer.appendChild(type === 'web' ? createSearchResult(item) : createImageResult(item));
        });
        createPagination(totalResults, page, data);
    }

    function createSearchResult(item) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'search-result';
        const thumbnailSrc = item.pagemap?.cse_thumbnail?.[0]?.src;
        const thumbnail = thumbnailSrc ? `<img src="${thumbnailSrc}" alt="" referrerpolicy="no-referrer">` : '';

        resultDiv.innerHTML = `
          <div class="result-thumbnail">${thumbnail}</div>
          <div class="result-content">
            <div class="result-url">${item.displayLink || ''}</div>
            <div class="result-title"><a href="${item.link || '#'}" target="_blank" rel="noopener noreferrer">${item.title || ''}</a></div>
            <div class="result-snippet">${typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(item.htmlSnippet || item.snippet || '') : (item.snippet || '')}</div>
            ${item.source ? `<div class="result-source" style="font-size:0.8em; color:#888; margin-top:5px;">Source: ${item.source}</div>` : ''}
          </div>`;
        return resultDiv;
    }

    function createImageResult(item) {
        const div = document.createElement('div');
        div.className = 'image-result';
        div.onclick = () => openImageModal(item);

        const imgUrl = fixVikidiaImageUrl(item.link || item.image?.thumbnailLink || '');
        const width = item.image?.width || 0;
        const height = item.image?.height || 0;
        const aspectRatio = width && height ? width / height : 1;
        let gridSpan = 1, aspectRatioCSS = '1 / 1';
        if (aspectRatio > 1.5) { gridSpan = 2; aspectRatioCSS = '2 / 1'; }
        else if (aspectRatio > 1.2) { aspectRatioCSS = '4 / 3'; }
        else if (aspectRatio < 0.7) { aspectRatioCSS = '3 / 4'; }

        div.style.gridColumn = `span ${gridSpan}`;

        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = item.title || '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.style.cssText = `width:100%; height:100%; object-fit:cover; display:block; border-radius:8px;`;
        img.onerror = () => { div.style.display = 'none'; };

        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `position:relative; width:100%; aspect-ratio:${aspectRatioCSS}; overflow:hidden; border-radius:8px; margin-bottom:8px; background-color:#f8f9fa;`;
        imageContainer.appendChild(img);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'image-info';
        infoDiv.innerHTML = `
            <div class="image-title" style="font-size:12px; line-height:1.3; color:#202124; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; margin-bottom:2px;">${item.title || ''}</div>
            <div class="image-source" style="font-size:11px; color:#70757a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.displayLink || ''}</div>`;

        div.style.cssText = `cursor:pointer; border-radius:8px; transition:all 0.2s ease; background-color:white; overflow:hidden; grid-column:span ${gridSpan};`;
        div.addEventListener('mouseenter', () => { div.style.transform = 'scale(1.02)'; div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; });
        div.addEventListener('mouseleave', () => { div.style.transform = 'scale(1)'; div.style.boxShadow = 'none'; });

        if (item.source) {
            const sourceBadge = document.createElement('div');
            sourceBadge.textContent = item.source;
            sourceBadge.style.cssText = `position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; padding:2px 5px; font-size:10px; border-radius:3px; z-index:1;`;
            imageContainer.appendChild(sourceBadge);
        }

        div.appendChild(imageContainer);
        div.appendChild(infoDiv);
        return div;
    }

    function createPagination(totalResults = 0, page = 1, data = null) {
        paginationEl.innerHTML = '';
        const maxPages = 10;
        const receivedItems = data?.items?.length || 0;
        if (page > 1) {
            const prev = document.createElement('button');
            prev.textContent = i18n.get('previousButton');
            prev.onclick = () => { currentPage--; performSearch(currentQuery, currentSearchType, currentPage, currentSort); updateUrl(currentQuery, currentSearchType, currentPage, currentSort); };
            paginationEl.appendChild(prev);
        }
        if (page < maxPages && receivedItems >= RESULTS_PER_PAGE) {
            const next = document.createElement('button');
            next.textContent = i18n.get('nextButton');
            next.onclick = () => { currentPage++; performSearch(currentQuery, currentSearchType, currentPage, currentSort); updateUrl(currentQuery, currentSearchType, currentPage, currentSort); };
            paginationEl.appendChild(next);
        }
    }

    function switchTab(type) {
        currentSearchType = type;
        webTab.classList.toggle('active', type === 'web');
        imagesTab.classList.toggle('active', type === 'images');
        if (currentQuery) {
            currentPage = 1;
            if (type === 'images') currentSort = '';
            performSearch(currentQuery, currentSearchType, currentPage, currentSort);
            updateUrl(currentQuery, currentSearchType, currentPage, currentSort);
        }
    }

    if (webTab) webTab.addEventListener('click', (e) => { e.preventDefault(); switchTab('web'); });
    if (imagesTab) imagesTab.addEventListener('click', (e) => { e.preventDefault(); switchTab('images'); });

    function setupSortOptions() {
        const sortPanel = document.getElementById('sortPanel');
        if (!sortPanel || !toolsButton) return;
        const sortOptions = sortPanel.querySelectorAll('.sort-option');
        sortOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const newSort = e.target.getAttribute('data-sort');
                if (newSort === currentSort) { sortPanel.style.display = 'none'; return; }
                currentSort = newSort;
                sortPanel.style.display = 'none';
                performSearch(currentQuery, currentSearchType, 1, currentSort);
                updateUrl(currentQuery, currentSearchType, 1, currentSort);
            });
        });
        toolsButton.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            sortPanel.style.display = sortPanel.style.display === 'block' ? 'none' : 'block';
            if (sortPanel.style.display === 'block') {
                sortOptions.forEach(opt => opt.classList.toggle('active', opt.getAttribute('data-sort') === currentSort));
            }
        });
    }

    function openImageModal(item) {
        modalImage.src = fixVikidiaImageUrl(item.link || '');
        modalImage.referrerPolicy = 'no-referrer';
        modalTitle.textContent = item.title || '';
        modalSource.innerHTML = item.image?.contextLink ? `<a href="${item.image.contextLink}" target="_blank" rel="noopener noreferrer">${item.displayLink || item.image.contextLink}</a>` : (item.displayLink || '');
        modalDimensions.textContent = item.image ? `${item.image.width} × ${item.image.height} pixels` : '';
        imageModal.style.display = 'flex';
    }
    function closeImageModal() { modalImage.src = ''; imageModal.style.display = 'none'; }
    if (imageModal) imageModal.addEventListener('click', (e) => { if (e.target === imageModal) closeImageModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeImageModal(); });

    searchInput.addEventListener('input', () => {
        if (clearButton) clearButton.style.display = searchInput.value.length > 0 ? 'block' : 'none';
        const value = searchInput.value.toLowerCase().trim();
        clearTimeout(inputDebounceTimer);
        inputDebounceTimer = setTimeout(() => {
            autocompleteDropdown.innerHTML = '';
            selectedIndex = -1;
            if (!value || !suggestions.length) { autocompleteDropdown.style.display = 'none'; return; }
            loadSuggestions();
            const matches = suggestions.filter(s => s.toLowerCase().includes(value)).slice(0, 8);
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.textContent = match;
                div.addEventListener('click', () => { searchInput.value = match; autocompleteDropdown.style.display = 'none'; doSearch(); });
                autocompleteDropdown.appendChild(div);
            });
            autocompleteDropdown.style.display = matches.length ? 'block' : 'none';
        }, 150);
    });

    searchInput.addEventListener('keydown', (e) => {
        const items = Array.from(autocompleteDropdown.getElementsByClassName('autocomplete-item'));
        if (!items.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex = Math.min(items.length - 1, selectedIndex + 1); updateSelection(items); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex = Math.max(-1, selectedIndex - 1); updateSelection(items); }
        else if (e.key === 'Enter') { if (selectedIndex >= 0 && items[selectedIndex]) { e.preventDefault(); items[selectedIndex].click(); autocompleteDropdown.style.display = 'none'; } }
        else if (e.key === 'Escape') { autocompleteDropdown.style.display = 'none'; }
    });

    function updateSelection(items) {
        items.forEach((it, idx) => it.classList.toggle('selected', idx === selectedIndex));
        if (selectedIndex >= 0 && items[selectedIndex]) items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('click', (e) => {
        if (!autocompleteDropdown.contains(e.target) && e.target !== searchInput) autocompleteDropdown.style.display = 'none';
        const sortPanel = document.getElementById('sortPanel');
        if (sortPanel?.style.display === 'block' && !sortPanel.contains(e.target) && e.target !== toolsButton) sortPanel.style.display = 'none';
    });

    if (clearButton) clearButton.addEventListener('click', () => { searchInput.value = ''; clearButton.style.display = 'none'; autocompleteDropdown.style.display = 'none'; searchInput.focus(); });

    const form = document.querySelector('.search-bar form') || document.querySelector('form');
    if (form) form.addEventListener('submit', doSearch);

    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('q')) {
            document.body.classList.add('is-resultspage');
            currentQuery = params.get('q');
            currentSearchType = params.get('type') || 'web';
            currentSort = params.get('sort') || '';
            currentPage = parseInt(params.get('p') || '1', 10) || 1;
            searchInput.value = currentQuery;
            if (clearButton && currentQuery) clearButton.style.display = 'block';
            webTab.classList.toggle('active', currentSearchType === 'web');
            imagesTab.classList.toggle('active', currentSearchType === 'images');
            performSearch(currentQuery, currentSearchType, currentPage, currentSort);
        } else if (document.getElementById('logo')) {
            document.body.classList.add('is-homepage');
        }
    } catch (e) { /* ignore */ }

    if (document.getElementById('sortPanel')) setupSortOptions();

    const urlParams = new URLSearchParams(window.location.search);
    const isDevMode = urlParams.has('dev');

    function updateQuotaDisplay() {
        if (!isDevMode) {
            const quotaEl = document.getElementById('quotaIndicator');
            if (quotaEl) quotaEl.remove();
            return;
        }
        const googleEnabled = isGoogleCseEnabled();
        const usage = quotaManager.getUsage();
        const webStats = webCache.getStats();
        const imageStats = imageCache.getStats();
        let quotaEl = document.getElementById('quotaIndicator');
        if (!quotaEl) {
            quotaEl = document.createElement('div');
            quotaEl.id = 'quotaIndicator';
            quotaEl.style.cssText = `position:fixed; bottom:10px; right:10px; background:#f8f9fa; border:1px solid #e0e0e0; border-radius:8px; padding:8px 12px; font-size:12px; color:#70757a; box-shadow:0 2px 6px rgba(0,0,0,0.15); z-index:1000;`;
            document.body.appendChild(quotaEl);
        }

        let quotaInfo = '';
        if (googleEnabled) {
            const quotaColor = usage.remaining > 20 ? '#34a853' : usage.remaining > 5 ? '#fbbc04' : '#ea4335';
            quotaInfo = `📊 API: <span style="color:${quotaColor}">${usage.remaining}</span>/${usage.limit} |`;
        } else {
            quotaInfo = `📊 API: <span style="color:#888">OFF</span> |`;
        }

        quotaEl.innerHTML = `
        ${quotaInfo}
        📋 Web: ${webStats.size}/${webStats.maxSize} |
        🖼️ Images: ${imageStats.enabled ? `${imageStats.size}/${imageStats.maxSize}` : 'OFF'} |
        <button id="devClearBtn" style="margin-left:8px; background:#fff; border:1px solid #ccc; border-radius:4px; padding:2px 6px; cursor:pointer;">🗑️ Vider</button>`;
        const clearBtn = document.getElementById('devClearBtn');
        if (clearBtn && !clearBtn.dataset.listenerAttached) {
            clearBtn.onclick = () => {
                if (confirm("Effacer tous les caches et quotas ?")) {
                    try { webCache.clear(); imageCache.clear(); localStorage.removeItem('api_usage'); } catch (e) { console.warn("Erreur clear cache:", e); }
                    alert("Caches vidés. Rechargement...");
                    window.location.reload();
                }
            };
            clearBtn.dataset.listenerAttached = 'true';
        }
    }
    updateQuotaDisplay();
}

// Attend que la configuration des API soit chargée avant d'initialiser le moteur de recherche.
// Cela évite une race condition où search.js s'exécute avant que loader.js n'ait fini
// de charger config-api-sources.json.
if (window.apiConfigLoaded) {
    console.log("search.js: 🏁 Configuration API déjà prête. Initialisation immédiate.");
    initializeSearch();
} else {
    console.log("search.js: ⏳ Configuration API non prête. En attente de l'événement \'apiConfigLoaded\'.");
    window.addEventListener('apiConfigLoaded', initializeSearch, { once: true });
}
