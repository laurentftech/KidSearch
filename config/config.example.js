// Configuration pour Search for Kids
// Copiez ce fichier vers config.js et remplissez vos vraies valeurs

const CONFIG = {
    // ============================================================
    // CONFIGURATION OPTIONNELLE - Google Custom Search Engine
    // ============================================================
    // ⚠️ NOUVEAU: Google CSE est maintenant OPTIONNEL
    // Si vous ne configurez pas ces valeurs, le moteur utilisera uniquement
    // les sources alternatives (Wikipedia, Vikidia, MeiliSearch, backend custom, etc.)
    // configurées dans config-api-sources.json

    // Remplacez par votre ID Google Custom Search Engine
    // Trouvable dans votre console Google CSE: https://cse.google.com/
    // Laissez vide ou commentez pour désactiver Google CSE
    GOOGLE_CSE_ID: '',

    // Clé API Google (nécessaire pour l'API JSON)
    // Obtenir sur : https://console.developers.google.com/
    // ⚠️ IMPORTANT: Restreindre la clé par référent HTTP pour la sécurité
    // Laissez vide ou commentez pour désactiver Google CSE
    GOOGLE_API_KEY: '',

    // Activer ou désactiver explicitement Google CSE
    // Si false, Google CSE ne sera jamais utilisé même si les clés sont présentes
    GOOGLE_CSE_ENABLED: true,

    // ============================================================
    // CONFIGURATION OPTIONNELLE
    // ============================================================

    // Activer ou désactiver la recherche vocale
    VOICE_SEARCH_ENABLED: true,

    // Configuration du panneau de connaissances (encadré éducatif au-dessus des résultats)
    // Ce panneau affiche des informations contextuelles depuis Vikidia ou Wikipedia
    KNOWLEDGE_PANEL_CONFIG: {
        // --- Configuration pour Vikidia (par défaut) ---
        ENABLED: true,
        // URL du backend KidSearch API (recommandé - évite CORS et erreurs 403)
        BACKEND_URL: 'http://localhost:8082/api',  // Changez pour votre URL de production
        // Paramètres de configuration (conservés pour référence)
        API_URL: 'https://{lang}.vikidia.org/w/api.php',      // {lang} sera remplacé par 'fr' ou 'en'
        BASE_URL: 'https://{lang}.vikidia.org/wiki/',
        SOURCE_NAME: "Vikidia - L'encyclopédie des 8-13 ans",
        EXTRACT_LENGTH: 400,        // Nombre de caractères pour l'extrait
        THUMBNAIL_SIZE: 300,        // Taille de l'image en pixels
        DISABLE_THUMBNAILS: false   // Mettre à true si les images causent des erreurs CORS

        /*
        // --- EXEMPLE: Configuration pour Wikipedia ---
        // Pour utiliser Wikipedia à la place, décommentez ce bloc et commentez celui de Vikidia.
        ENABLED: true,
        API_URL: 'https://{lang}.wikipedia.org/w/api.php',
        BASE_URL: 'https://{lang}.wikipedia.org/wiki/',
        SOURCE_NAME: "Wikipédia - L'encyclopédie libre",
        EXTRACT_LENGTH: 400,
        THUMBNAIL_SIZE: 300,
        DISABLE_THUMBNAILS: false
        */
    }

    // ============================================================
    // SOURCES DE RECHERCHE ADDITIONNELLES
    // ============================================================
    //
    // ⚠️ IMPORTANT: Les sources de recherche (Wikipedia, Vikidia, MeiliSearch, etc.)
    // doivent maintenant être configurées dans: config-api-sources.json
    //
    // Ce nouveau système permet:
    // - Une gestion plus flexible des sources multiples
    // - Aucun changement de code pour ajouter/retirer des sources
    // - Une configuration plus claire et structurée
    //
    // Pour configurer vos sources:
    // 1. Copiez: cp config-api-sources-example.json config-api-sources.json
    // 2. Éditez config-api-sources.json pour activer/désactiver les sources
    //
    // Les anciennes configurations (WIKIPEDIA_SEARCH_CONFIG, VIKIDIA_SEARCH_CONFIG, etc.)
    // sont obsolètes et ne doivent plus être utilisées ici.
    // Elles sont conservées uniquement pour la rétrocompatibilité si le fichier JSON est absent.
    //
    // ============================================================
};

// Export pour utilisation dans les autres scripts, uniquement côté client
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}