#!/bin/bash

# Script pour réactiver les knowledge panels une fois l'endpoint implémenté

echo "🔧 Configuration des knowledge panels..."

# Vérifier que le proxy CORS tourne
if ! lsof -ti:8081 > /dev/null 2>&1; then
    echo "⚠️  Le proxy CORS n'est pas démarré sur le port 8081"
    echo "   Démarrez-le avec: node proxy-cors.js"
    exit 1
fi

# Tester l'endpoint
echo "🧪 Test de l'endpoint /api/knowledge-panel..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081/api/knowledge-panel?q=dinosaures&lang=fr")

if [ "$RESPONSE" = "200" ]; then
    echo "✅ Endpoint fonctionnel (HTTP $RESPONSE)"

    # Modifier config.js pour activer les knowledge panels
    sed -i.bak 's/ENABLED: false,.*$/ENABLED: true, \/\/ Activé - endpoint disponible/' config/config.js
    sed -i.bak "s|BACKEND_URL: 'https://searchforkids.*'|BACKEND_URL: 'http://localhost:8081/api'|" config/config.js

    echo "✅ Knowledge panels activés dans config.js"
    echo "📝 Un backup a été créé : config.js.bak"
    echo ""
    echo "🎉 Configuration terminée !"
    echo "   Rechargez http://localhost:8000/?dev=1 pour tester"
else
    echo "❌ Endpoint non disponible (HTTP $RESPONSE)"
    echo "   Vérifiez que votre backend a bien l'endpoint /api/knowledge-panel"
    echo "   Voir KNOWLEDGE_PANEL_API.md pour les détails d'implémentation"
    exit 1
fi
