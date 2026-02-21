// knowledge-panels.js - Version corrigée avec vérification CONFIG
// Affiche un panneau de connaissances pour certaines requêtes

async function tryDisplayKnowledgePanel(query) {
    // Vérification que CONFIG existe
    if (typeof CONFIG === 'undefined') {
        console.warn('⚠️ CONFIG non disponible pour knowledge panel');
        return;
    }

    // Vérifie si les panneaux de connaissances sont activés
    if (!CONFIG.KNOWLEDGE_PANEL_CONFIG?.ENABLED) {
        return;
    }

    const config = CONFIG.KNOWLEDGE_PANEL_CONFIG;

    // Détecte la langue de la requête
    const queryLang = detectQueryLanguage(query);
    const lang = queryLang || (typeof i18n !== 'undefined' ? i18n.getLang() : 'fr');

    try {
        const backendUrl = config.BACKEND_URL;

        if (backendUrl) {
            // Priorité : backend API (évite CORS/CloudFlare)
            const apiUrl = new URL(`${backendUrl}/knowledge-panel`);
            apiUrl.searchParams.set('q', query);
            apiUrl.searchParams.set('lang', lang);

            const response = await fetch(apiUrl);

            if (!response.ok) {
                if (response.status === 404) {
                    console.log('No knowledge panel found for query:', query);
                } else {
                    console.warn('Knowledge panel API error:', response.status);
                }
                return;
            }

            const data = await response.json();
            displayKnowledgePanel({
                title: data.title,
                extract: data.extract,
                thumbnail: config.DISABLE_THUMBNAILS ? null : data.thumbnail,
                url: data.url,
                source: data.source
            });
        } else {
            // Fallback : appels directs MediaWiki (Vikidia/Wikipedia)
            await tryDisplayKnowledgePanelDirect(query, config, lang);
        }
    } catch (error) {
        console.error('Erreur lors de la création du panneau de connaissances:', error);
    }
}

// Fallback : appels directs à l'API MediaWiki quand BACKEND_URL n'est pas configuré
async function tryDisplayKnowledgePanelDirect(query, config, lang) {
    const apiUrlTemplate = config.API_URL;
    if (!apiUrlTemplate) return;

    const apiUrl = apiUrlTemplate.replace('{lang}', lang);
    const baseUrl = (config.BASE_URL || '').replace('{lang}', lang);

    // Étape 1 : recherche des candidats
    const searchUrl = new URL(apiUrl);
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', query);
    searchUrl.searchParams.set('srlimit', '3');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) return;

    const searchData = await searchResponse.json();
    const searchResults = (searchData.query?.search || []).map(r => ({
        title: r.title,
        snippet: r.snippet?.replace(/<[^>]+>/g, '') || ''
    }));

    const best = findBestMatch(query, searchResults);
    if (!best) return;

    // Étape 2 : extrait + miniature pour le meilleur résultat
    const detailUrl = new URL(apiUrl);
    detailUrl.searchParams.set('action', 'query');
    detailUrl.searchParams.set('prop', 'extracts|pageimages');
    detailUrl.searchParams.set('titles', best.title);
    detailUrl.searchParams.set('exintro', 'true');
    detailUrl.searchParams.set('explaintext', 'true');
    detailUrl.searchParams.set('pithumbsize', String(config.THUMBNAIL_SIZE || 300));
    detailUrl.searchParams.set('format', 'json');
    detailUrl.searchParams.set('origin', '*');

    const detailResponse = await fetch(detailUrl);
    if (!detailResponse.ok) return;

    const detailData = await detailResponse.json();
    const pages = detailData.query?.pages || {};
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined) return;

    const extract = page.extract || '';
    if (!extract) return;

    const thumbnail = config.DISABLE_THUMBNAILS ? null : (page.thumbnail?.source || null);
    const articleUrl = baseUrl + encodeURIComponent(best.title.replace(/ /g, '_'));

    displayKnowledgePanel({
        title: best.title,
        extract: extract,
        thumbnail: thumbnail,
        url: articleUrl,
        source: config.SOURCE_NAME || 'Vikidia'
    });
}

function displayKnowledgePanel(data) {
    const resultsContainer = document.getElementById('resultsContainer');
    if (!resultsContainer) return;

    // Vérifie si un panneau existe déjà
    let panel = document.getElementById('knowledgePanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'knowledgePanel';
        panel.className = 'knowledge-panel';
        resultsContainer.insertBefore(panel, resultsContainer.firstChild);
    }

    // Sanitize tous les champs avant insertion dans le DOM
    const sanitize = (typeof DOMPurify !== 'undefined')
        ? (str) => DOMPurify.sanitize(str || '', { ALLOWED_TAGS: [] })
        : (str) => (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const safeTitle = sanitize(data.title);
    const safeSource = sanitize(data.source);

    // Valide que les URLs sont bien en https pour éviter javascript: injection
    const isSafeUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
    const safeUrl = isSafeUrl(data.url) ? data.url : '#';
    const safeThumbnail = isSafeUrl(data.thumbnail) ? data.thumbnail : null;

    // Tronque l'extrait si trop long
    const maxLength = CONFIG.KNOWLEDGE_PANEL_CONFIG?.EXTRACT_LENGTH || 400;
    let extract = sanitize(data.extract);
    if (extract.length > maxLength) {
        extract = extract.substring(0, maxLength) + '...';
    }

    // Construction du HTML
    const thumbnailHTML = safeThumbnail
        ? `<div class="panel-thumbnail"><img src="${safeThumbnail}" alt="${safeTitle}" style="display: block !important;"></div>`
        : '';

    panel.innerHTML = `
        ${thumbnailHTML}
        <div class="panel-content">
            <h3 class="panel-title">${safeTitle}</h3>
            <p class="panel-extract">${extract}</p>
            <div class="panel-footer">
                <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="panel-link">
                    ${typeof i18n !== 'undefined' ? i18n.get('readMore') : 'En savoir plus'} →
                </a>
                <span class="panel-source">${safeSource}</span>
            </div>
        </div>
    `;

    if (data.thumbnail) {
        const img = panel.querySelector('.panel-thumbnail img');
        if (img) {
            img.addEventListener('error', function() {
                this.style.display = 'none';
                console.warn('Failed to load knowledge panel thumbnail:', data.thumbnail);
            });
        }
    }

    // Animation d'apparition
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(-10px)';
    setTimeout(() => {
        panel.style.transition = 'all 0.3s ease';
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
    }, 100);
}

function findBestMatch(query, searchResults) {
    if (!searchResults || searchResults.length === 0) {
        return null;
    }

    const normalizeText = (text) => text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Retire les accents
        .replace(/[^a-z0-9\s]/g, ' ') // Garde seulement lettres/chiffres/espaces
        .replace(/\s+/g, ' ')
        .trim();

    // Fonction pour obtenir le radical d'un mot (stemming simple)
    const stem = (word) => {
        // Retire les pluriels et terminaisons courantes
        return word
            .replace(/aux$/, 'al')       // pluriel: animaux → animal (avant /x$/)
            .replace(/eux$/, 'eu')       // pluriel: cheveux → cheveu (avant /x$/)
            .replace(/s$/, '')           // pluriel: dinosaures → dinosaure
            .replace(/x$/, '')           // pluriel: voix → voi
            .replace(/tion$/, '')        // substantifs: révolution → révolu
            .replace(/ment$/, '')        // adverbes: rapidement → rapide
            .replace(/able$/, '')        // adjectifs: aimable → aim
            .replace(/ible$/, '');       // adjectifs: visible → vis
    };

    const queryNorm = normalizeText(query);
    if (!queryNorm) return null;
    const queryWords = queryNorm.split(' ').filter(w => w.length > 2);
    const queryStemmed = stem(queryNorm);

    // Score chaque résultat
    const scored = searchResults.map(result => {
        const titleNorm = normalizeText(result.title);
        const titleStemmed = stem(titleNorm);
        const snippetNorm = normalizeText(result.snippet || '');

        let score = 0;

        // Correspondance exacte du titre = très bon
        if (titleNorm === queryNorm || titleStemmed === queryStemmed) {
            score += 100;
        }

        // Le titre contient toute la requête = bon
        if (titleNorm.includes(queryNorm) || titleStemmed.includes(queryStemmed)) {
            score += 50;
        }

        // Le titre commence par la requête = bon
        if (titleNorm.startsWith(queryNorm) || titleStemmed.startsWith(queryStemmed)) {
            score += 30;
        }

        // Compte combien de mots de la requête sont dans le titre (avec stemming)
        let wordsInTitle = 0;
        queryWords.forEach(word => {
            const wordStem = stem(word);
            if (titleNorm.includes(word) || titleStemmed.includes(wordStem)) {
                wordsInTitle++;
            }
        });
        score += wordsInTitle * 10;

        // Bonus si tous les mots de la requête sont dans le titre
        if (queryWords.length > 1 && wordsInTitle === queryWords.length) {
            score += 25;
        }

        // Pénalité si le titre est très long (moins spécifique)
        if (titleNorm.length > queryNorm.length * 3) {
            score -= 5;
        }

        // Bonus pour les mots dans le snippet
        const wordsInSnippet = queryWords.filter(word => {
            const wordStem = stem(word);
            return snippetNorm.includes(word) || snippetNorm.includes(wordStem);
        }).length;
        score += wordsInSnippet * 2;

        return { result, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Ne garde que si le score est suffisant (au moins 15 points)
    // Pour "Dassault Rafale", si le meilleur résultat est "tempête" avec un score < 15, on refuse
    const MINIMUM_SCORE = 15;
    if (scored[0].score < MINIMUM_SCORE) {
        console.log(`❌ Knowledge panel: meilleur score trop faible (${scored[0].score}) pour "${scored[0].result.title}"`);
        return null;
    }

    console.log(`✅ Knowledge panel: "${scored[0].result.title}" (score: ${scored[0].score})`);
    return scored[0].result;
}

function detectQueryLanguage(query) {
    const lq = query.toLowerCase();
    if (/[àâçéèêëîïôûùüÿœæ]/i.test(lq) || /\b(le|la|les|un|une|des)\b/i.test(lq)) {
        return 'fr';
    }
    if (/\b(the|and|for|what|who|are)\b/i.test(lq)) {
        return 'en';
    }
    return null;
}

// Styles CSS pour le panneau (injecté dynamiquement)
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        .knowledge-panel {
            background: #fff;
            border: 1px solid #dfe1e5;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
            display: flex;
            gap: 16px;
            box-shadow: 0 1px 6px rgba(32,33,36,.28);
        }

        .panel-thumbnail {
            flex-shrink: 0;
            display: block !important;
        }

        .panel-thumbnail img {
            width: 150px;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
            display: block !important;
        }

        .panel-content {
            flex: 1;
            min-width: 0;
        }

        .panel-title {
            font-size: 20px;
            font-weight: 500;
            color: #202124;
            margin: 0 0 8px 0;
        }

        .panel-extract {
            font-size: 14px;
            line-height: 1.6;
            color: #4d5156;
            margin: 0 0 12px 0;
        }

        .panel-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .panel-link {
            color: #1a73e8;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
        }

        .panel-link:hover {
            text-decoration: underline;
        }

        .panel-source {
            font-size: 12px;
            color: #70757a;
        }

        @media (max-width: 768px) {
            .knowledge-panel {
                flex-direction: column;
            }

            .panel-thumbnail img {
                width: 100%;
                height: auto;
                max-height: 200px;
                display: block !important;
            }
        }
    `;
    document.head.appendChild(style);
}