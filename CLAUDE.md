# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KidSearch is a child-safe search engine built as a static website using vanilla JavaScript, HTML, and CSS. It can operate with or without Google Custom Search Engine (CSE), using multiple alternative sources (MediaWiki APIs, MeiliSearch, Wikimedia Commons, custom backends) to provide filtered, educational content for children ages 8-13.

**Google CSE is now OPTIONAL** - The system can run entirely on alternative search sources if desired.

Live demo: https://laurentftech.github.io/kidsearch

## Development Setup

### Local Development
```bash
# Serve the static files locally
python -m http.server 8000

# Or use VS Code's Live Server extension
# Then open http://localhost:8000
```

### Configuration

**Two configuration files serve different purposes:**

1. **`config/config.js`** (Required) - Core application settings:
   ```bash
   cp config/config.example.js config/config.js
   ```
   Contains:
   - `GOOGLE_CSE_ID` - Your Google Custom Search Engine ID (OPTIONAL - leave empty to disable)
   - `GOOGLE_API_KEY` - Your Google API key (OPTIONAL - leave empty to disable)
   - `GOOGLE_CSE_ENABLED` - Explicit enable/disable flag for Google CSE (default: true)
   - `VOICE_SEARCH_ENABLED` - Enable/disable voice search
   - `KNOWLEDGE_PANEL_CONFIG` - Settings for the info panel display

2. **`config/config-api-sources.json`** (Recommended) - Search sources configuration:
   ```bash
   cp config/config-api-sources-example.json config/config-api-sources.json
   ```
   Contains array of search sources (Wikipedia, Vikidia, MeiliSearch, etc.)

**IMPORTANT:** If `config-api-sources.json` exists, it completely replaces any legacy source configs (`WIKIPEDIA_SEARCH_CONFIG`, `VIKIDIA_SEARCH_CONFIG`, etc.) in `config.js`. These old configs are only used as fallback if the JSON file is missing.

### Dev Mode
Add `?dev=1` to the URL to enable:
- API quota monitoring display
- Cache statistics
- Active sources logging
- Manual cache clearing

## Architecture

### Core System Components

**Configuration Loading** (`js/loader.js`):
- Loads configuration in two phases:
  1. Synchronously loads `config/config.js` (or falls back to `config.demo.js`)
  2. Asynchronously loads `config/config-api-sources.json`
- Dispatches `apiConfigLoaded` event when ready
- Handles migration from legacy config format to new JSON-based API sources
- Sets `window.apiConfigLoaded` flag

**Search Engine** (`js/search.js`):
- Waits for `apiConfigLoaded` event before initializing
- Manages multiple search sources via `ApiSourceManager`
- Implements hybrid search optionally combining Google CSE with alternative sources
- **Google CSE Detection**: Automatically detects if Google CSE is configured via `isGoogleCseEnabled()` (search.js:634)
- Works entirely without Google CSE if credentials are empty or `GOOGLE_CSE_ENABLED: false`
- Key classes:
  - `WebSearchCache` / `ImageSearchCache`: In-memory 7-day caching (max 200 web / 100 image entries)
  - `ApiQuotaManager`: Tracks daily Google API usage (90 requests/day limit) - only used when Google CSE is enabled
  - `GenericApiSource`: Unified interface for MediaWiki, MeiliSearch, and custom APIs
  - `ApiSourceManager`: Orchestrates multiple search sources and result merging

**Search Result Merging**:
- Google results get weight 1.0, secondary sources use configured weights (0.1-1.0)
- Applies lexical scoring based on query term matching in title/snippet
- Deduplicates by normalizing URLs (removes protocol, www, query params, trailing slashes)
- For images, uses `contextLink` for deduplication (more reliable than direct image URLs)

**Knowledge Panels** (`js/knowledge-panels.js`):
- Fetches contextual information from MediaWiki APIs (Vikidia, Wikipedia)
- Displays rich educational content above search results
- Only triggers on first page of web searches
- **Relevance scoring system**: Requests 3 results, scores each based on query-title match, stemming, and lexical similarity
- **Minimum score threshold**: Only displays if score ≥ 15 points (prevents irrelevant panels like "Tempête" for "Dassault Rafale")
- **French stemming**: Handles plurals, common suffixes to match "dinosaures" → "Dinosaure"
- Configurable via `CONFIG.KNOWLEDGE_PANEL_CONFIG`

**Internationalization** (`js/i18n.js`):
- Detects browser language (French/English)
- Stores preference in localStorage
- Updates content via data-i18n attributes and dynamic DOM manipulation
- Includes language-specific recommended sites

### Generic API Source System

The system supports three API types configured in `config-api-sources.json`:

**1. MediaWiki APIs** (`type: "mediawiki"`):
- Used for Wikipedia, Vikidia, Simple English Wikipedia, Wikimedia Commons
- Features: title/snippet search, thumbnail fetching, image search with category exclusions
- Required config: `apiUrl`, `baseUrl`, `articlePath`

**2. MeiliSearch** (`type: "meilisearch"`):
- Full-text search with optional semantic/hybrid search
- Supports highlighting, cropping, filtering by language
- Required config: `apiUrl`, `apiKey`, `indexName`
- Optional: `semanticSearch.enabled`, `semanticSearch.semanticRatio` (0-1)

**3. Custom APIs** (`type: "custom"`):
- Generic HTTP API wrapper with configurable URL patterns, headers, and response transformers
- Supports GET/POST methods
- Field mapping via `titleField`, `linkField`, `snippetField`
- Response navigation via `resultsPath` (dot notation)
- **KidSearch Backend Integration**: FastAPI backend at `http://localhost:8080/api/search` provides unified search with MeiliSearch + Google CSE + semantic reranking

**Source Configuration Options**:
- `enabled`: Toggle source on/off
- `weight`: Result prioritization (0.1-1.0)
- `excludeFromGoogle`: Automatically exclude these domains from Google CSE queries
- `excludeDomains`: List of domains to exclude
- `supportsWeb` / `supportsImages`: Capability flags
- `resultsLimit`: Max results per source

### Key Architectural Patterns

**Initialization Race Condition Handling**:
- `search.js` checks `window.apiConfigLoaded` flag before initializing
- If not ready, listens for `apiConfigLoaded` event
- Prevents search initialization before API config is loaded

**Language Detection**:
- Detects French: accented characters or French articles (le/la/les/un/une/des)
- Detects English: common words (the/and/for/what/who/are)
- Falls back to browser language via i18n system
- Applies detected language to Google CSE `lr` parameter and MediaWiki API URLs

**URL Management**:
- Search state in URL params: `q` (query), `type` (web/images), `p` (page), `sort` (date/relevance)
- Homepage (`index.html`) redirects to `results.html` with query
- URL updated via `pushState` on searches/pagination/tab switches

**Security**:
- All result snippets sanitized via DOMPurify
- XSS protection on user-generated content
- Google API key should be restricted by HTTP referrer in Google Cloud Console

## Common Tasks

### Adding a New API Source
1. Edit `config/config-api-sources.json`
2. Add source object with appropriate type (mediawiki/meilisearch/custom)
3. Set `enabled: true` and configure weight
4. Add `excludeDomains` to prevent Google CSE duplicates
5. No code changes needed - system auto-detects new sources

### Modifying Search Results Display
- Web results: `createSearchResult()` in search.js:800
- Image results: `createImageResult()` in search.js:817
- Knowledge panels: `displayKnowledgePanel()` in knowledge-panels.js:81

### Customizing Autocomplete
- Edit `config/suggestions.json` (French) or `config/suggestions-en.json` (English)
- Simple JSON array of suggestion strings
- Auto-loads based on i18n language setting

### Integrating the KidSearch Backend
The FastAPI backend (`http://localhost:8080`) is already configured as a custom source:
- **ID**: `kidsearch-backend`
- **Weight**: 0.95 (high priority)
- **Features**: Unified MeiliSearch + Google CSE + semantic reranking
- **Enable/Disable**: Set `enabled: true/false` in `config-api-sources.json`
- See `BACKEND_INTEGRATION.md` for detailed configuration and testing

### Testing Different Configurations
- Use `?dev=1` to monitor API usage and cache
- Check browser console for detailed logging
- Use `window.reloadApiConfiguration()` to reload API config without refresh

## File Structure

### Key Files
- `index.html` - Homepage with recommended sites
- `results.html` - Search results page (web + images tabs)
- `js/loader.js` - Configuration bootstrapper
- `js/search.js` - Main search engine (1050 lines)
- `js/knowledge-panels.js` - Educational info panels
- `js/i18n.js` - Bilingual French/English support
- `js/voice-search.js` - Web Speech API integration
- `config/config.js` - Google API credentials (gitignored)
- `config/config-api-sources.json` - Search sources config (gitignored)

### Configuration Files
- `config.example.js` - Template for Google CSE setup (includes legacy source configs for backward compatibility)
- `config.demo.js` - Public demo configuration
- `config-api-sources-example.json` - Template for modern API sources configuration (recommended)
- `config.js` - Your actual config (gitignored)
- `config-api-sources.json` - Your actual API sources (gitignored)

## Configuration System Details

### Dual Configuration Support

The system supports **two configuration approaches** for backward compatibility:

**Modern Approach (Recommended):**
- `config.js` contains only: `GOOGLE_CSE_ID`, `GOOGLE_API_KEY`, `GOOGLE_CSE_ENABLED`, `VOICE_SEARCH_ENABLED`, `KNOWLEDGE_PANEL_CONFIG`
- `config-api-sources.json` contains all search sources in a structured JSON array
- **Google CSE is optional**: Leave `GOOGLE_CSE_ID` and `GOOGLE_API_KEY` empty or set `GOOGLE_CSE_ENABLED: false` to disable
- Benefits: Cleaner separation, easier to manage multiple sources, no code changes needed

**Legacy Approach (Deprecated):**
- Everything in `config.js` including `WIKIPEDIA_SEARCH_CONFIG`, `VIKIDIA_SEARCH_CONFIG`, etc.
- Used only if `config-api-sources.json` doesn't exist or fails to load
- `loader.js` (lines 91-234) automatically migrates these to the new format

**Migration Logic:**
1. `loader.js` first tries to load `config-api-sources.json`
2. If successful, legacy configs in `config.js` are **completely ignored**
3. If it fails, falls back to migrating legacy configs from `config.js`
4. If no configs exist, loads hardcoded defaults (Vikidia + Wikipedia)

**To clean up your configuration:**
- Remove `WIKIPEDIA_SEARCH_CONFIG`, `VIKIDIA_SEARCH_CONFIG`, `COMMONS_IMAGE_SEARCH_CONFIG`, `MEILISEARCH_CONFIG` from `config.js`
- Keep only Google API settings and `KNOWLEDGE_PANEL_CONFIG` in `config.js`
- Move all source configurations to `config-api-sources.json`

## Important Implementation Details

### Google CSE Query Modification
- System automatically appends `-site:domain` exclusions to queries for domains covered by secondary sources
- This prevents duplicate results from Google CSE and MediaWiki/MeiliSearch
- Handled in `buildGoogleCseApiUrl()` (search.js:623)

### Cache Key Generation
- Includes query, page, sort, and config signature
- Config signature based on enabled sources (e.g., "v1-w1-m1")
- Ensures cache invalidation when sources are toggled

### Image Search Grid Layout
- Dynamic `grid-column: span` based on image aspect ratio
- Wide images (>1.5 ratio) span 2 columns
- CSS Grid with `auto-fill` for responsive layout
- Lazy loading with `img.loading = 'lazy'`

### Semantic Search (MeiliSearch)
- Enabled via `semanticSearch.enabled: true` in source config
- Uses hybrid search with configurable `semanticRatio` (0-1)
- 0 = pure keyword, 1 = pure semantic, 0.75 = balanced (recommended)
- Requires MeiliSearch embedder configuration on server side

## Companion Projects

### KidSearch Backend (FastAPI)
FastAPI backend providing unified search with:
- MeiliSearch integration for indexed content
- Google CSE integration for web results
- Semantic reranking using sentence transformers
- Intelligent caching and quota management
- `/api/search`, `/api/health`, `/api/stats`, `/api/feedback` endpoints

### MeiliSearchCrawler
URL: https://github.com/laurentftech/MeilisearchCrawler
- Web crawler designed to populate MeiliSearch instances
- Use this to index custom educational content for inclusion in KidSearch

## Production Deployment

- Static hosting only (no server-side code)
- Works on: GitHub Pages, Netlify, Vercel, Caddy, Apache, Nginx, Synology NAS
- **Google CSE is optional**: Works without Google API credentials if alternative sources are configured
- If using Google CSE: Restrict Google API key by HTTP referrer for security
- Configure search sources in `config/config-api-sources.json`
- Minimum viable setup: Vikidia + Wikipedia (works without Google CSE)
