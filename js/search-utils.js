function calculateLexicalScore(item, query) {
    const title = (item.title || '').toLowerCase();
    const snippet = (item.snippet || '').toLowerCase();
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return 0;
    const queryWords = lowerQuery.split(/[\s,.:;!?]+/).filter(w => w.length > 1);
    let score = 0;
    if (title.includes(lowerQuery)) score += 1.0;
    else if (queryWords.length > 1 && queryWords.every(w => title.includes(w))) score += 0.5;
    if (title.startsWith(lowerQuery)) score += 0.4;
    if (snippet && queryWords.length > 1 && queryWords.every(w => snippet.includes(w))) score += 0.35;
    return score;
}

function mergeAndWeightResults(googleResults, secondaryResults, query, searchType = 'web') {
    let allResults = googleResults.map((item, idx) => ({
        ...item,
        source: item.source || 'Google',
        originalIndex: idx,
        calculatedWeight: 1.0 * (1 - idx / googleResults.length / 2) + calculateLexicalScore(item, query)
    }));

    secondaryResults.forEach(results =>
        results.forEach((item, idx) =>
            allResults.push({
                ...item,
                originalIndex: idx,
                calculatedWeight: item.weight * (1 - idx / results.length / 2) + calculateLexicalScore(item, query)
            })
        )
    );

    allResults.sort((a, b) => b.calculatedWeight - a.calculatedWeight || a.originalIndex - b.originalIndex);

    const normalizeUrl = (url) => {
        if (!url) return null;
        // Normalize by removing protocol, www, query params, and trailing slash
        return url.replace(/^https?:\/\/(www\.)?/, '').split('?')[0].split('#')[0].replace(/\/$/, '');
    };

    const seen = new Set();
    return allResults.filter(r => {
        // For images, the context link is a more reliable deduplication key than the direct image link (which can be a CDN link).
        const urlToNormalize = (searchType === 'images' && r.image?.contextLink) ? r.image.contextLink : r.link;
        const normalized = normalizeUrl(urlToNormalize);

        if (!normalized || seen.has(normalized)) {
            return false;
        }
        seen.add(normalized);
        return true;
    });
}
