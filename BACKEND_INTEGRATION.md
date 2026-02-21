# Backend API Integration

## What Was Done

I've successfully integrated your new FastAPI backend (`http://localhost:8080`) as a search source in KidSearch.

### Configuration Added

**File:** `config/config-api-sources.json`

A new API source has been added:

```json
{
  "id": "kidsearch-backend",
  "name": "KidSearch Backend",
  "type": "custom",
  "enabled": true,
  "weight": 0.95,
  "apiUrl": "http://localhost:8080/api/search?q={query}&lang={lang}&limit={limit}&use_cse=true&use_reranking=true",
  "method": "GET",
  "resultsLimit": 10,
  "resultsPath": "results",
  "titleField": "title",
  "linkField": "url",
  "snippetField": "excerpt",
  "excludeFromGoogle": false,
  "supportsImages": false,
  "description": "Backend API unifiée avec Meilisearch + Google CSE + reranking sémantique"
}
```

### Code Changes

**File:** `js/search.js` (lines 279-298)

Enhanced the `searchCustom()` method to:
- Use the `site` field from backend if available (instead of extracting from URL)
- Use the `score` field from backend (0-1) as result weight
- Extract thumbnail images from the `images[]` array in backend responses
- Map backend response format to frontend format

### Backend API Used

**Endpoint:** `GET /api/search`

**Parameters:**
- `q`: Search query (required)
- `lang`: Language (fr/en/all)
- `limit`: Max results (1-100)
- `use_cse`: Include Google CSE results (default: true)
- `use_reranking`: Apply semantic reranking (default: true)

**Features:**
- ✅ Unified search across MeiliSearch + Google CSE
- ✅ Semantic reranking for better relevance
- ✅ Intelligent caching
- ✅ Quota management
- ✅ Response includes stats (processing time, source breakdown)

## Testing the Integration

### 1. Verify Backend is Running

```bash
curl http://localhost:8080/api/health
```

Expected output:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "services": {
    "meilisearch": true,
    "google_cse": true
  }
}
```

### 2. Test Backend Search

```bash
curl "http://localhost:8080/api/search?q=dinosaures&limit=5"
```

### 3. Test Frontend Integration

**Option A: Using Browser**

1. Open: `http://localhost:8000/?dev=1`
2. Search for something (e.g., "dinosaures")
3. Open browser console (F12)
4. Look for:
   ```
   ✅ Configuration des API chargée depuis : config/config-api-sources.json
   🔌 Sources actives (5/10) : Vikidia, Wikipedia, Simple English Wikipedia, Wikimedia Commons, KidSearch Backend
   ```

**Option B: Check Active Sources**

Open browser console on results page and type:
```javascript
// Check if backend source is loaded and active
apiManager.getActiveSources().find(s => s.id === 'kidsearch-backend')
```

### 4. Verify Backend Results Are Included

After performing a search, results from "KidSearch Backend" should appear with:
- 🏷️ Source badge showing "KidSearch Backend"
- ⭐ Higher relevance (weight: 0.95)
- 🖼️ Thumbnail images (if available in backend response)
- 📊 Semantic reranking applied

## Configuration Options

### Adjust Backend Weight

In `config-api-sources.json`, change the `weight` value:
- `0.95` (current): Backend results are highly prioritized
- `1.0`: Maximum priority
- `0.5`: Equal with Wikipedia/Vikidia
- `0.3`: Lower priority

### Disable Backend Temporarily

Set `"enabled": false` in `config-api-sources.json`

### Toggle CSE or Reranking

Modify the `apiUrl`:
- Remove `&use_cse=true` to disable Google CSE integration
- Remove `&use_reranking=true` to disable semantic reranking
- Change `&limit={limit}` to a fixed value like `&limit=20`

### Exclude Backend Domains from Google CSE

If you want to prevent Google from returning results already in your backend:

1. Add backend domains to `excludeDomains`:
```json
"excludeFromGoogle": true,
"excludeDomains": ["scouts-europe.org", "your-other-domain.com"]
```

2. The system will automatically append `-site:domain.com` to Google queries

## Expected Behavior

### Search Flow with Backend

1. User searches for "dinosaures"
2. Frontend makes parallel requests to:
   - ✅ Google CSE API
   - ✅ Vikidia API
   - ✅ Wikipedia API
   - ✅ Simple English Wikipedia API
   - ✅ **Backend API** (which internally queries MeiliSearch + Google CSE + reranking)
3. Results are merged and weighted:
   - Backend results: weight 0.95
   - Wikipedia/Vikidia: weight 0.5
   - Google CSE direct: weight 1.0
4. Lexical scoring applied based on query term matching
5. Results deduplicated by normalized URL
6. Final sorted list displayed to user

### Result Deduplication

The system intelligently deduplicates:
- If backend returns a URL also found via Google CSE → keeps higher-scored version
- If backend returns a URL from Wikipedia → keeps the one with better snippet
- Normalization removes protocol, www, query params, trailing slashes

## Monitoring and Debugging

### Dev Mode Statistics

Add `?dev=1` to URL to see quota indicator showing:
- 📊 Google API quota usage
- 📋 Web cache size
- 🖼️ Image cache size
- 🗑️ Manual cache clear button

### Backend API Statistics

Check backend performance:
```bash
curl http://localhost:8080/api/stats
```

Returns:
```json
{
  "total_searches": 142,
  "searches_last_hour": 23,
  "avg_response_time_ms": 245.3,
  "cse_quota_used": 15,
  "cse_quota_limit": 100,
  "cache_hit_rate": 0.67,
  "top_queries": [...],
  "error_rate": 0.02
}
```

### Console Logs

With dev mode enabled, check console for:
```
⚡️ Recherche sémantique activée pour KidSearch Backend (ratio: 0.75)
```

## Troubleshooting

### Backend Results Not Appearing

**Check 1: Backend is running**
```bash
lsof -i :8080
curl http://localhost:8080/api/health
```

**Check 2: CORS enabled**
Backend should allow `http://localhost:8000` origin.

**Check 3: Configuration loaded**
Browser console should show:
```
✅ Configuration API chargée : 5 sources disponibles depuis config-api-sources.json
```

**Check 4: Source is enabled**
```javascript
// In browser console
apiManager.getSource('kidsearch-backend').enabled
// Should return: true
```

### Backend Returns Empty Results

**Check backend directly:**
```bash
curl "http://localhost:8080/api/search?q=test&lang=fr&limit=5"
```

If backend works but frontend doesn't show results:
- Check browser network tab for failed requests
- Verify `resultsPath` in config matches backend response structure
- Check field mappings: `titleField`, `linkField`, `snippetField`

### Duplicate Results

If you see the same result twice (once from backend, once from Google CSE):

1. The backend already queries Google CSE internally
2. Consider disabling direct Google CSE in frontend:
   - Comment out Wikipedia/Vikidia sources
   - Rely solely on backend API

**OR** configure backend to exclude domains already handled by frontend sources.

## Performance Considerations

### Caching Strategy

- **Frontend cache:** 7 days, 200 entries (in-memory)
- **Backend cache:** Configurable in backend settings

### Parallel Requests

Frontend makes all API calls in parallel using `Promise.all()`, so:
- Total time = slowest source
- Typical: 200-500ms for full search
- Backend with reranking: 300-800ms
- Wikimedia Commons images: 400-1000ms

### Optimizations

1. **Reduce active sources** for faster searches
2. **Increase backend limit** to get more results in single call
3. **Disable reranking** if speed > relevance
4. **Use backend-only mode** to avoid redundant Google CSE calls

## Next Steps

### Recommended Configuration for Production

**Option 1: Backend-Only (Simplest)**
```json
{
  "apiSources": [
    {
      "id": "kidsearch-backend",
      "enabled": true,
      "weight": 1.0,
      ...
    },
    {
      "id": "wikimedia-commons",
      "enabled": true,
      ...
    }
  ]
}
```

**Option 2: Hybrid (Current)**
Keep all sources active for maximum coverage and redundancy.

**Option 3: Language-Specific**
Use backend for French, Wikipedia/Vikidia for English educational content.

### Future Enhancements

- [ ] Add feedback endpoint integration (`POST /api/feedback`)
- [ ] Display backend stats in dev mode UI
- [ ] Add toggle to switch between backend/direct mode
- [ ] Implement result quality scoring using backend's relevance scores
- [ ] Cache backend responses separately with longer TTL

## Summary

✅ **Backend successfully integrated as a custom API source**
✅ **Semantic reranking and MeiliSearch results now available**
✅ **High-priority weighting (0.95) for backend results**
✅ **Image thumbnails from backend are displayed**
✅ **No changes needed to HTML/CSS - works out of the box**

The system is now running in **hybrid mode**: combining your backend's intelligent search with direct Wikipedia/Vikidia integration for maximum coverage and relevance.
