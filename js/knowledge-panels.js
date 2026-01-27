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
        // Use KidSearch backend API instead of direct MediaWiki API calls
        // This avoids CORS and CloudFlare blocking issues
        const backendUrl = config.BACKEND_URL || 'http://localhost:8082/api';
        const apiUrl = new URL(`${backendUrl}/knowledge-panel`);
        apiUrl.searchParams.set('q', query);
        apiUrl.searchParams.set('lang', lang);

        console.log('🔍 Fetching Knowledge Panel details from:', apiUrl.toString());

        const response = await fetch(apiUrl);

        // If not found (404) or error, silently return
        if (!response.ok) {
            if (response.status === 404) {
                console.log('No knowledge panel found for query:', query);
            } else {
                console.warn('Knowledge panel API error:', response.status);
            }
            return;
        }

        const data = await response.json();

        if (!data.extract) {
            return; // No extract available
        }

    // Display the panel
    console.log('Knowledge panel data received:', JSON.stringify(data, null, 2));
    console.log('Thumbnail URL:', data.thumbnail);
    console.log('Thumbnails disabled in config:', config.DISABLE_THUMBNAILS);

    displayKnowledgePanel({
        title: data.title,
        extract: data.extract,
        thumbnail: config.DISABLE_THUMBNAILS ? null : data.thumbnail,
        url: data.url,
        source: data.source
    });

    } catch (error) {
        console.error('Erreur lors de la création du panneau de connaissances:', error);
    }
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

    // Tronque l'extrait si trop long
    const maxLength = CONFIG.KNOWLEDGE_PANEL_CONFIG?.EXTRACT_LENGTH || 400;
    let extract = data.extract;
    if (extract.length > maxLength) {
        extract = extract.substring(0, maxLength) + '...';
    }

    // Construction du HTML
    console.log('Final thumbnail URL being rendered:', data.thumbnail);
    const thumbnailHTML = data.thumbnail
        ? `<div class="panel-thumbnail"><img src="${data.thumbnail}" alt="${data.title}" style="display: block !important;"></div>`
        : '';

    panel.innerHTML = `
        ${thumbnailHTML}
        <div class="panel-content">
            <h3 class="panel-title">${data.title}</h3>
            <p class="panel-extract">${extract}</p>
            <div class="panel-footer">
                <a href="${data.url}" target="_blank" rel="noopener noreferrer" class="panel-link">
                    ${typeof i18n !== 'undefined' ? i18n.get('readMore') : 'En savoir plus'} →
                </a>
                <span class="panel-source">${data.source}</span>
            </div>
        </div>
    `;

    // Gestion de l'erreur de chargement de l'image (alternative à l'attribut onerror obsolète)
    if (data.thumbnail) {
        const img = panel.querySelector('.panel-thumbnail img');
        if (img) {
            img.addEventListener('error', function() {
                this.style.display = 'none';
                console.error('IMAGE LOAD ERROR: Failed to load thumbnail:', data.thumbnail);
                console.log('Image element:', this);
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
            .replace(/s$/, '')           // pluriel: dinosaures → dinosaure
            .replace(/x$/, '')           // pluriel: chevaux → chevau
            .replace(/aux$/, 'al')       // pluriel: animaux → animal
            .replace(/eux$/, 'eu')       // pluriel: cheveux → cheveu
            .replace(/tion$/, '')        // substantifs: révolution → révolu
            .replace(/ment$/, '')        // adverbes: rapidement → rapide
            .replace(/able$/, '')        // adjectifs: aimable → aim
            .replace(/ible$/, '');       // adjectifs: visible → vis
    };

    const queryNorm = normalizeText(query);
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

    console.log('Knowledge panel scores:', scored.map(s => `${s.result.title}: ${s.score}`).join(', '));

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