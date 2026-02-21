// Fichier de configuration pour la DÉMONSTRATION GitHub Pages
// Ce fichier utilise des clés factices. La recherche ne fonctionnera pas.
// Pour une utilisation locale, copiez config.example.js vers config.js et ajoutez vos vraies clés.

const CONFIG = {
    // ============================================================
    // CONFIGURATION GOOGLE CSE (OPTIONNEL - désactivé en démo)
    // ============================================================

    // Google CSE est maintenant OPTIONNEL. En mode démo, il est désactivé
    // pour utiliser uniquement les sources alternatives (Wikipedia, Vikidia, etc.)
    GOOGLE_CSE_ID: '',           // Vide = Google CSE désactivé
    GOOGLE_API_KEY: '',          // Vide = Google CSE désactivé
    GOOGLE_CSE_ENABLED: false,   // Explicitement désactivé pour la démo

    // ============================================================
    // CONFIGURATION OPTIONNELLE
    // ============================================================

    // Activer ou désactiver la recherche vocale
    VOICE_SEARCH_ENABLED: true,

    // Configuration pour les panneaux de connaissances
    KNOWLEDGE_PANEL_CONFIG: {
        ENABLED: true,
        // BACKEND_URL: 'http://localhost:8082/api', // Optionnel : backend KidSearch
        // Si BACKEND_URL est absent, les panneaux utilisent l'API Vikidia directement
        BACKEND_URL: null,
        API_URL: 'https://{lang}.vikidia.org/w/api.php',
        BASE_URL: 'https://{lang}.vikidia.org/wiki/',
        SOURCE_NAME: "Vikidia - L'encyclopédie des 8-13 ans",
        EXTRACT_LENGTH: 400,
        THUMBNAIL_SIZE: 300,
        DISABLE_THUMBNAILS: true
    }

    // ============================================================
    // NOTE: Sources de recherche additionnelles
    // ============================================================
    //
    // Les sources de recherche (Wikipedia, Vikidia, MeiliSearch, etc.)
    // sont maintenant configurées dans: config-api-sources.json
    //
    // Le fichier config-api-sources-example.json est chargé automatiquement
    // en mode démo si config-api-sources.json n'existe pas.
    //
    // Les anciennes configurations (WIKIPEDIA_SEARCH_CONFIG, etc.) ci-dessous
    // sont obsolètes et conservées uniquement pour rétrocompatibilité.
    //
    // ============================================================

    // OBSOLÈTE - Utilisez config-api-sources.json à la place
    /*
    WIKIPEDIA_SEARCH_CONFIG: {
        ENABLED: false,
        API_URL: 'https://fr.wikipedia.org/w/api.php',
        BASE_URL: 'https://fr.wikipedia.org/wiki/',
        SOURCE_NAME: "Wikipedia",
        WEIGHT: 1,
        THUMBNAIL_SIZE: 300
    },

    VIKIDIA_SEARCH_CONFIG: {
        ENABLED: true,
        API_URL: 'https://fr.vikidia.org/w/api.php',
        BASE_URL: 'https://fr.vikidia.org/wiki/',
        SOURCE_NAME: "Vikidia",
        WEIGHT: 1,
        THUMBNAIL_SIZE: 300
    },

    COMMONS_IMAGE_SEARCH_CONFIG: {
        ENABLED: true,
        API_URL: 'https://commons.wikimedia.org/w/api.php',
        BASE_URL: 'https://commons.wikimedia.org/wiki/',
        SOURCE_NAME: "Wikimedia Commons",
        WEIGHT: 0.7,
        THUMBNAIL_SIZE: 400
    },

    MEILISEARCH_CONFIG: {
        ENABLED: false,
        API_URL: 'https://your-meili-instance.com',
        API_KEY: 'your_meili_search_api_key',
        INDEX_NAME: 'your_index_name',
        SOURCE_NAME: 'Ma Source Personnalisée',
        WEIGHT: 0.6,
        BASE_URLS: ['https://your-website.com'],
        semanticSearch: {
            enabled: true,
            semanticRatio: 0.75
        }
    }
    */
};

// Export pour utilisation dans les autres scripts, uniquement côté client
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
