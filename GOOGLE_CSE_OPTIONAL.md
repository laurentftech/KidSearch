# Making Google CSE Optional in KidSearch

As of this update, **Google Custom Search Engine (CSE) is now completely optional** in KidSearch. The application can run entirely on alternative search sources.

## Why Make Google CSE Optional?

- **Avoid API quotas**: Google CSE free tier has a limit of 100 queries/day
- **Reduce costs**: Paid Google CSE can be expensive for high-traffic sites
- **Privacy**: Some users prefer not to use Google services
- **Custom content**: Focus on curated educational sources (Wikipedia, Vikidia, MeiliSearch)
- **Backend integration**: Use a custom FastAPI backend for unified search instead

## How to Disable Google CSE

### Option 1: Leave credentials empty (Recommended)

Edit `config/config.js`:
```javascript
const CONFIG = {
    GOOGLE_CSE_ID: '',        // Leave empty
    GOOGLE_API_KEY: '',       // Leave empty
    GOOGLE_CSE_ENABLED: true, // Will auto-disable if credentials are empty
    // ... rest of config
};
```

### Option 2: Explicit disable flag

Edit `config/config.js`:
```javascript
const CONFIG = {
    GOOGLE_CSE_ID: 'your-id-here',     // Can have credentials
    GOOGLE_API_KEY: 'your-key-here',   // but CSE won't be used
    GOOGLE_CSE_ENABLED: false,         // Explicitly disabled
    // ... rest of config
};
```

## What Happens When Google CSE is Disabled?

1. **Search sources**: Only alternative sources from `config-api-sources.json` are used
2. **No API calls**: Zero requests to Google CSE API
3. **No quota tracking**: The API quota indicator shows "OFF" in dev mode
4. **Full functionality**: All features work normally (web search, image search, knowledge panels)
5. **Performance**: Potentially faster since fewer API calls

## Recommended Alternative Sources

When running without Google CSE, configure these sources in `config-api-sources.json`:

### Minimum Viable Configuration
```json
{
  "apiSources": [
    {
      "id": "vikidia",
      "name": "Vikidia",
      "type": "mediawiki",
      "enabled": true,
      "weight": 0.8,
      "apiUrl": "https://{lang}.vikidia.org/w/api.php",
      "baseUrl": "https://{lang}.vikidia.org",
      "articlePath": "/wiki/",
      "resultsLimit": 10,
      "supportsWeb": true,
      "supportsImages": false
    },
    {
      "id": "wikipedia",
      "name": "Wikipedia",
      "type": "mediawiki",
      "enabled": true,
      "weight": 0.7,
      "apiUrl": "https://{lang}.wikipedia.org/w/api.php",
      "baseUrl": "https://{lang}.wikipedia.org",
      "articlePath": "/wiki/",
      "resultsLimit": 10,
      "supportsWeb": true,
      "supportsImages": false
    }
  ]
}
```

### Enhanced Configuration with Images
Add Wikimedia Commons for image search:
```json
{
  "id": "wikimedia-commons",
  "name": "Wikimedia Commons",
  "type": "mediawiki",
  "enabled": true,
  "weight": 0.9,
  "apiUrl": "https://commons.wikimedia.org/w/api.php",
  "baseUrl": "https://commons.wikimedia.org",
  "thumbnailSize": 300,
  "resultsLimit": 20,
  "supportsWeb": false,
  "supportsImages": true,
  "imageSearch": {
    "enabled": true,
    "excludeCategories": [
      "Nudity in art",
      "Erotic art",
      "Violence"
    ]
  }
}
```

### Advanced: Custom Backend
Use the KidSearch FastAPI backend for unified search with semantic ranking:
```json
{
  "id": "kidsearch-backend",
  "name": "KidSearch Backend",
  "type": "custom",
  "enabled": true,
  "weight": 0.95,
  "apiUrl": "http://localhost:8080/api/search?q={query}&lang={lang}&limit={limit}",
  "method": "GET",
  "resultsLimit": 20,
  "titleField": "title",
  "linkField": "url",
  "snippetField": "snippet",
  "resultsPath": "results",
  "supportsWeb": true,
  "supportsImages": false
}
```

## Testing Without Google CSE

1. **Verify configuration**:
   ```javascript
   // In browser console
   console.log('Google CSE enabled:', window.isGoogleCseEnabled ? window.isGoogleCseEnabled() : 'Function not available');
   ```

2. **Check dev mode**:
   - Open `http://localhost:8000/results.html?dev=1`
   - Bottom-right indicator should show: `📊 API: OFF`

3. **Perform searches**:
   - Web search should return results from configured sources
   - Console should show: `ℹ️ Google CSE désactivé, utilisation des sources alternatives uniquement`

4. **Verify no Google API calls**:
   - Open browser DevTools → Network tab
   - Filter by `googleapis.com`
   - Should see zero requests to `googleapis.com`

## Performance Considerations

### With Google CSE
- ✅ Wide web coverage
- ✅ High-quality ranking
- ❌ 100 queries/day limit (free tier)
- ❌ Additional latency (~200-500ms)
- ❌ Privacy concerns

### Without Google CSE
- ✅ Unlimited queries
- ✅ No API costs
- ✅ Better privacy
- ✅ Faster (no external API calls)
- ❌ Limited to configured sources
- ⚠️ Requires good alternative sources

## Hybrid Approach (Recommended)

For best results, use a **custom backend** that:
1. Queries MeiliSearch for indexed content
2. Optionally queries Google CSE (server-side, with rate limiting)
3. Applies semantic reranking
4. Caches aggressively
5. Returns unified results

This gives you:
- The benefits of Google CSE when needed
- Server-side quota management
- Semantic search capabilities
- No client-side Google API dependency

See `BACKEND_INTEGRATION.md` for implementation details.

## Troubleshooting

### "No results found" for all queries
- **Cause**: No alternative sources are enabled
- **Fix**: Enable at least one source in `config-api-sources.json`

### Image search returns no results
- **Cause**: No image sources configured
- **Fix**: Enable Wikimedia Commons or add MeiliSearch with image support

### Results seem low quality
- **Cause**: Alternative sources have fewer results than Google CSE
- **Fix**:
  - Increase `resultsLimit` for each source
  - Add more sources (Simple English Wikipedia, Wikibooks, etc.)
  - Implement a custom backend with semantic ranking

### Performance is slow
- **Cause**: Too many sources or large `resultsLimit`
- **Fix**:
  - Reduce `resultsLimit` per source (try 5-10)
  - Disable sources you don't need
  - Enable caching (already on by default)

## Re-enabling Google CSE

To re-enable Google CSE later:

1. Add your credentials to `config/config.js`:
   ```javascript
   GOOGLE_CSE_ID: 'your-actual-id',
   GOOGLE_API_KEY: 'your-actual-key',
   GOOGLE_CSE_ENABLED: true,
   ```

2. Reload the page
3. Verify in dev mode: `📊 API: 90/90` (shows quota)

Google results will be merged with alternative sources automatically.
