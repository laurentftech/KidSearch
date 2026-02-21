# Knowledge Panel API Specification

## Endpoint

```
GET /api/knowledge-panel?q={query}&lang={lang}
```

## Paramètres

- `q` (required): La requête de recherche (ex: "dinosaures", "Robert Surcouf")
- `lang` (required): Code langue (fr, en, all)

## Format de réponse

### Succès (200 OK)

```json
{
  "title": "Dinosaure",
  "extract": "Les dinosaures sont un groupe de reptiles ayant vécu durant l'ère mésozoïque...",
  "thumbnail": "https://upload.wikimedia.org/wikipedia/commons/thumb/abc123.jpg",
  "url": "https://fr.vikidia.org/wiki/Dinosaure",
  "source": "Vikidia - L'encyclopédie des 8-13 ans"
}
```

**Champs requis :**
- `title` (string): Titre de l'article
- `extract` (string): Extrait de texte (le frontend le tronquera si trop long)
- `url` (string): URL complète vers l'article source
- `source` (string): Nom de la source (ex: "Vikidia FR", "Wikipedia")

**Champs optionnels :**
- `thumbnail` (string|null): URL de l'image miniature (peut être null)

### Pas de résultat (404 Not Found)

```json
{
  "detail": "No knowledge panel found for this query"
}
```

Le frontend gère gracieusement les 404 sans afficher d'erreur.

### Erreur serveur (500)

Le frontend affichera un warning dans la console mais continuera de fonctionner.

## Comportement attendu

1. **Pertinence** : Retourner un résultat uniquement si très pertinent
   - Le frontend appelle cet endpoint pour chaque recherche (page 1 uniquement)
   - Si la requête n'est pas assez spécifique, retourner 404
   - Exemple : "dinosaure" → OK, "comment" → 404

2. **Sources recommandées** :
   - Vikidia (priorité pour les 8-13 ans)
   - Wikipedia / Simple English Wikipedia
   - Sites éducatifs validés

3. **Longueur de l'extrait** :
   - Recommandé : 300-500 caractères
   - Le frontend tronquera à 400 caractères par défaut (configurable dans config.js)

4. **Images** :
   - URL complète et accessible (pas de restrictions CORS)
   - Taille recommandée : 200-400px
   - Si aucune image pertinente : `"thumbnail": null`

## Exemple d'implémentation (FastAPI)

```python
from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter()

@router.get("/api/knowledge-panel")
async def get_knowledge_panel(q: str, lang: str = "fr"):
    """
    Récupère un panneau de connaissances depuis Vikidia ou Wikipedia
    """
    # Déterminer l'API MediaWiki à utiliser
    if lang == "en":
        api_url = "https://simple.wikipedia.org/w/api.php"
        base_url = "https://simple.wikipedia.org/wiki/"
        source_name = "Simple English Wikipedia"
    else:  # fr ou all
        api_url = "https://fr.vikidia.org/w/api.php"
        base_url = "https://fr.vikidia.org/wiki/"
        source_name = "Vikidia - L'encyclopédie des 8-13 ans"

    # Recherche de l'article le plus pertinent
    async with httpx.AsyncClient() as client:
        # 1. Chercher les articles correspondants
        search_params = {
            "action": "query",
            "format": "json",
            "list": "search",
            "srsearch": q,
            "srlimit": 3,
            "srprop": "score"
        }

        search_response = await client.get(api_url, params=search_params)
        search_data = search_response.json()

        if not search_data.get("query", {}).get("search"):
            raise HTTPException(status_code=404, detail="No knowledge panel found")

        # Prendre le premier résultat (meilleur score)
        best_match = search_data["query"]["search"][0]
        page_title = best_match["title"]

        # 2. Récupérer l'extrait et la miniature
        page_params = {
            "action": "query",
            "format": "json",
            "titles": page_title,
            "prop": "extracts|pageimages",
            "exintro": True,
            "explaintext": True,
            "exsectionformat": "plain",
            "piprop": "thumbnail",
            "pithumbsize": 300
        }

        page_response = await client.get(api_url, params=page_params)
        page_data = page_response.json()

        pages = page_data.get("query", {}).get("pages", {})
        page_id = list(pages.keys())[0]
        page = pages[page_id]

        # Construire la réponse
        return {
            "title": page.get("title", page_title),
            "extract": page.get("extract", ""),
            "thumbnail": page.get("thumbnail", {}).get("source"),
            "url": f"{base_url}{page_title.replace(' ', '_')}",
            "source": source_name
        }
```

## Configuration Frontend

### 1. Avec le proxy CORS local (développement)

Modifiez `config/config.js` :

```javascript
KNOWLEDGE_PANEL_CONFIG: {
    ENABLED: true,
    BACKEND_URL: 'http://localhost:8081/api', // Proxy CORS
    SOURCE_NAME: "Vikidia - L'encyclopédie des 8-13 ans",
    EXTRACT_LENGTH: 400,
    THUMBNAIL_SIZE: 300,
    DISABLE_THUMBNAILS: false
}
```

Le proxy CORS (`proxy-cors.js`) redirigera vers `https://kidsearch.laurentftech.fr.eu.org/api`.

### 2. Sans proxy (production)

Si votre backend a CORS correctement configuré :

```javascript
KNOWLEDGE_PANEL_CONFIG: {
    ENABLED: true,
    BACKEND_URL: 'https://kidsearch.laurentftech.fr.eu.org/api',
    SOURCE_NAME: "Vikidia - L'encyclopédie des 8-13 ans",
    EXTRACT_LENGTH: 400,
    THUMBNAIL_SIZE: 300,
    DISABLE_THUMBNAILS: false
}
```

**IMPORTANT** : Assurez-vous que le backend renvoie les headers CORS :

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "https://laurentftech.github.io"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Test

Une fois l'endpoint implémenté :

```bash
# Test direct
curl "https://kidsearch.laurentftech.fr.eu.org/api/knowledge-panel?q=dinosaures&lang=fr"

# Test via proxy CORS (développement)
curl "http://localhost:8081/api/knowledge-panel?q=dinosaures&lang=fr"
```

Résultat attendu :
```json
{
  "title": "Dinosaure",
  "extract": "Les dinosaures sont un groupe...",
  "thumbnail": "https://...",
  "url": "https://fr.vikidia.org/wiki/Dinosaure",
  "source": "Vikidia FR"
}
```

## Intégration Frontend

Le frontend appelle automatiquement cet endpoint :
- **Quand** : À chaque recherche (page 1 uniquement)
- **Où** : Fichier `js/knowledge-panels.js`, fonction `tryDisplayKnowledgePanel()`
- **Affichage** : En haut des résultats de recherche

Aucune modification du code JavaScript n'est nécessaire si vous respectez le format de réponse.
