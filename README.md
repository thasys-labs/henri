# 🍺 Henri von Einbeck

**Ein KI-gesteuerter Bier-Sommelier für die Einbecker Brauhaus AG**

Henri von Einbeck ist ein charmanter, leicht snobistischer Bier-Sommelier, der seit Anno Domini 1378 im Dienste der Einbecker Brauerei steht. Er behandelt Bier mit derselben Ehrfurcht, die ein französischer Grand-Cru-Sommelier dem Burgunderwein widmet.

![Henri Demo](assets/henri-dark.svg)

## ✨ Features

- **Interaktives Tasting**: Henri führt durch ein personalisiertes Bier-Tasting mit kreativen Multiple-Choice-Fragen
- **Bier-Empfehlungen**: Basierend auf Stimmung, Anlass und Geschmack
- **Verkostungsnotizen**: Poetische Beschreibungen in gehobener Weinsprache
- **Speisen-Pairings**: Passende Empfehlungen zu jedem Bier
- **Themes**: Dunkles, helles und goldenes Design
- **Markdown-Support**: Formatierte Antworten mit Listen, Fettdruck etc.
- **Streaming**: Echtzeit-Textausgabe für natürliches Gespräch

## 🛠️ Tech Stack

- **Backend**: FastAPI + Python
- **KI**: Anthropic Claude API (claude-haiku-4-5-20251001)
- **Frontend**: Vanilla HTML/CSS/JS mit SSE-Streaming
- **Markdown**: marked.js

## 📦 Installation

```bash
# Repository klonen
git clone https://github.com/your-username/henri.git
cd henri

# Dependencies installieren
pip install -r requirements.txt

# API-Key konfigurieren
echo "ANTHROPIC_API_KEY=your-key-here" > .env.local

# Server starten
uvicorn main:app --reload
```

Dann öffne http://localhost:8000

## 🚀 Deployment

### Render / Railway (empfohlen)

1. Repository auf GitHub pushen
2. Auf [render.com](https://render.com) oder [railway.app](https://railway.app) verbinden
3. Environment Variable setzen: `ANTHROPIC_API_KEY`
4. Deployen!

### Heroku

```bash
heroku create henri-einbeck
heroku config:set ANTHROPIC_API_KEY=your-key-here
git push heroku main
```

### Fly.io

```bash
fly launch
fly secrets set ANTHROPIC_API_KEY=your-key
fly deploy
```

## 📁 Projektstruktur

```
henri/
├── main.py              # FastAPI App & Static Files
├── chat.py              # Chat API Endpoint mit SSE-Streaming
├── henri.py             # KI-Charakter: Tools & System Prompt
├── index.html           # Frontend (Single Page App)
├── assets/
│   ├── beers/           # Lokale Bierbilder
│   ├── beers.json       # Bier-Metadaten (Style, Note, Pairing)
│   ├── henri-dark.svg   # Avatar (Dark Theme)
│   ├── henri-light.svg  # Avatar (Light Theme)
│   └── henri-gold.svg   # Avatar (Gold Theme)
├── requirements.txt
├── Procfile             # Für Heroku/Render
└── README.md
```

## 🍻 Das Einbecker Sortiment

| Kategorie | Biere |
|-----------|-------|
| **Pilsner** | Brauherren Pils, Pilsener |
| **Alkoholfrei** | Brauherren Alkoholfrei, Lager AF, Radler AF, Null Bock |
| **Radler** | Radler Naturtrüb, Blutorange |
| **Lager** | Lager, Helles, Dunkel, Landbier |
| **Bockbiere** | Ur-Bock Hell, Ur-Bock Dunkel, Weizen-Bock, Winter-Bock, Mai-Ur-Bock, Barrel Bock |
| **Saisonal** | Weihnachtsbier, Einhundert |

## 🎨 Themes

Wechsle zwischen drei Designs über die Buttons in der Sidebar:

- **Dark** (Standard): Elegantes Dunkel
- **Light**: Helles, freundliches Design  
- **Gold**: Warme, bierige Atmosphäre

## 📝 Lizenz

MIT

---

*"Ein gutes Bier ist wie ein gutes Gespräch – es braucht Zeit, Hingabe und den richtigen Partner."*  
— Henri von Einbeck, 1378
