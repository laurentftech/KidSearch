# Configuration Migration Guide

## Current Situation

Your `config/config.js` contains **duplicate and obsolete configurations** that are being ignored by the system.

## What's Happening

Since you have `config-api-sources.json`, the following sections in your `config.js` are **completely ignored**:
- Lines 27-34: `WIKIPEDIA_SEARCH_CONFIG` ❌ OBSOLETE
- Lines 36-43: `VIKIDIA_SEARCH_CONFIG` ❌ OBSOLETE
- Lines 46-53: `COMMONS_IMAGE_SEARCH_CONFIG` ❌ OBSOLETE
- Lines 56-68: `MEILISEARCH_CONFIG` ❌ OBSOLETE

These are only used as fallback if `config-api-sources.json` is missing or fails to load.

## Recommended Clean Configuration

Replace your current `config/config.js` with this cleaned version:

```javascript
// Configuration pour Search for Kids
// Ne pas commiter ce fichier sur GitHub !

const CONFIG = {
    // ============================================================
    // CONFIGURATION REQUISE - Google Custom Search Engine
    // ============================================================

    // ID de votre Google Custom Search Engine
    GOOGLE_CSE_ID: '03e255a7baebb452c',

    // Clé API Google (nécessaire pour l'API JSON)
    // ⚠️ IMPORTANT: Restreindre la clé par référent HTTP pour la sécurité
    GOOGLE_API_KEY: 'AIzaSyDbXDg7Om6xY7VESG7LJ33J7_SH1fG0fo4',

    // ============================================================
    // CONFIGURATION OPTIONNELLE
    // ============================================================

    // Activer ou désactiver la recherche vocale
    VOICE_SEARCH_ENABLED: true,

    // Configuration du panneau de connaissances
    KNOWLEDGE_PANEL_CONFIG: {
        ENABLED: true,
        API_URL: 'https://fr.vikidia.org/w/api.php',
        BASE_URL: 'https://fr.vikidia.org/wiki/',
        SOURCE_NAME: "Vikidia - L'encyclopédie des 8-13 ans",
        EXTRACT_LENGTH: 400,
        THUMBNAIL_SIZE: 300,
        DISABLE_THUMBNAILS: false
    }

    // ============================================================
    // SOURCES DE RECHERCHE
    // ============================================================
    //
    // Les sources de recherche (Wikipedia, Vikidia, MeiliSearch, etc.)
    // sont configurées dans: config-api-sources.json
    //
    // ✅ Votre configuration actuelle se trouve dans ce fichier
    // ============================================================
};

// Export pour utilisation dans les autres scripts, uniquement côté client
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
```

## Your Current API Sources Configuration

Your search sources are properly configured in `config-api-sources.json`:

- ✅ Vikidia (enabled: true)
- ✅ Wikipedia (enabled: true)
- ✅ Simple English Wikipedia (enabled: true)
- ✅ Wikimedia Commons (enabled: true, images only)
- ✅ MeiliSearch (enabled: true, localhost:8000)

**No changes needed to this file** - it's working correctly!

## Benefits of This Cleanup

1. **Removes confusion** - Single source of truth for search sources
2. **Easier maintenance** - All sources in one JSON file
3. **Clearer structure** - Google settings separate from search sources
4. **Better security** - Sensitive API keys in separate gitignored file

## Migration Steps

1. **Backup your current config:**
   ```bash
   cp config/config.js config/config.js.backup
   ```

2. **Edit `config/config.js`** and remove lines 27-68 (all the `*_SEARCH_CONFIG` sections)

3. **Verify** that your `config-api-sources.json` has all your sources configured correctly

4. **Test** - Load the application and check console for:
   ```
   ✅ Configuration des API chargée depuis : config/config-api-sources.json
   ```

5. **Confirm** all your sources are active in dev mode (`?dev=1` in URL)

## What NOT to Remove from config.js

Keep these sections - they're still needed:
- ✅ `GOOGLE_CSE_ID`
- ✅ `GOOGLE_API_KEY`
- ✅ `VOICE_SEARCH_ENABLED`
- ✅ `KNOWLEDGE_PANEL_CONFIG`

## If You Want to Go Back

If you want to use the old single-file approach:
1. Delete `config-api-sources.json`
2. Restore the `*_SEARCH_CONFIG` sections in `config.js`
3. The system will automatically migrate them on load

But this is **not recommended** - the new JSON-based system is cleaner and more flexible.
