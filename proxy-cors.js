#!/usr/bin/env node

/**
 * Proxy CORS local pour le développement
 * Redirige les requêtes de localhost:8000 vers le backend en production
 * Usage: node proxy-cors.js
 */

const http = require('http');
const https = require('https');
const url = require('url');

const BACKEND_URL = 'https://kidsearch.laurentftech.fr.eu.org';
const PORT = 8081;

// Origines autorisées (développement local + production GitHub Pages)
const ALLOWED_ORIGINS = [
    'http://localhost:8000',
    'http://localhost:3000',
    'http://127.0.0.1:8000',
    'https://laurentftech.github.io',
];

const server = http.createServer((req, res) => {
    const origin = req.headers['origin'];
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Gérer les requêtes OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Construire l'URL du backend
    const targetUrl = BACKEND_URL + req.url;
    console.log(`📡 Proxy: ${req.method} ${req.url} -> ${targetUrl}`);

    // Faire la requête au backend
    const proxyReq = https.request(targetUrl, {
        method: req.method,
        headers: {
            ...req.headers,
            host: url.parse(BACKEND_URL).host
        }
    }, (proxyRes) => {
        // Copier les headers de la réponse
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('❌ Erreur proxy:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    });

    req.pipe(proxyReq);
});

server.listen(PORT, () => {
    console.log(`✅ Proxy CORS démarré sur http://localhost:${PORT}`);
    console.log(`🔀 Redirige vers: ${BACKEND_URL}`);
    console.log(`📝 Exemple: http://localhost:${PORT}/api/health`);
});
