# FinCrew

**Your business. Watched 24/7.**

FinCrew is a light-theme financial co-pilot for a fictional small business. It detects simulated changes, explains their impact, recommends an action, asks the owner before applying it, updates the business health, and records the decision.

## Requirements

- Python 3.9 or newer
- Windows, macOS, or Linux
- A modern browser; Chrome or Edge is recommended for speech recognition

The core application works locally without an internet connection or an AI key. Flask and `python-dotenv` are the only Python dependencies.

## Install and run

### Windows (beginner-friendly)

1. Install Python and enable **Add Python to PATH** during installation.
2. Double-click `start-fincrew.cmd`.
3. On first run, the launcher creates a virtual environment and installs the requirements.
4. Open [http://localhost:5000](http://localhost:5000) if it does not open automatically.

### Manual setup

From this folder, run:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python server.py
```

Then visit [http://localhost:5000](http://localhost:5000). On macOS or Linux, create and activate `.venv` using the commands appropriate to your shell.

## 3D home page

The project also includes a lightweight 3D home experience built with Vite + Three.js. It runs alongside the existing Flask pages and provides a richer business campus view while keeping the classic 2D dashboard available.

### Requirements

- Node.js 22 or newer (Vite 8 requirement)
- Python 3.9+
- A modern browser

### Install

From this folder:

```powershell
npm install
```

### Local development

```powershell
npm run dev -- --host 0.0.0.0
```

### Production build

```powershell
npm run build
```

### Flask serving

`server.py` serves the static HTML and built assets. The home page loads the Vite bundle when present and falls back to the original 2D experience if not available. The local app remains fully functional without an internet connection or AI key.

## Publish a public deployment

The repository includes a Render Blueprint (`render.yaml`) and a multi-stage Docker build. Render builds the Vite/Three.js home page and packages it with the Flask app, then publishes the service over HTTPS.

1. Push this project to a GitHub repository. Do not commit `.env`, API keys, `.venv`, or `node_modules`.
2. In Render, choose **New → Blueprint**, connect that GitHub repository, and apply the `render.yaml` configuration.
3. Wait for the Docker build and health check to complete, then open the HTTPS URL Render assigns to the service.

The hosted demo uses in-memory simulation state: restarting or redeploying resets the simulated business, and the service is configured with one Gunicorn worker so requests share the same state. Use a persistent database and durable session design before relying on this demo for real business records.

## Starting the backend

`server.py` serves the frontend and provides the JSON API on `127.0.0.1:5000` by default. Set `PORT` in the environment to choose another port. The in-memory business state resets when the server restarts; the AI conversation history is saved locally in the browser.

## Optional AI API setup

The built-in deterministic FinCrew reasoning answers common questions using the current simulated business state. It requires no account, key, or internet connection.

An optional Anthropic API key enables external AI-generated answers:

1. Copy `.env.example` to `.env`.
2. Set `ANTHROPIC_API_KEY` in `.env`.
3. Restart the server.

The key is read only by the Python backend and must never be placed in browser files. If the API is unavailable or the key is missing, FinCrew continues to use local reasoning.

## Game-A-Thon mode

Open the **Simulation** page from the dashboard, or visit [http://localhost:5000/fincrew-game.html](http://localhost:5000/fincrew-game.html). Press **START SIMULATION** to run the five events for AriaCraft Supplies:

1. ₹85,000 late customer payment
2. ₹1,20,000 unexpected expense
3. ₹48,500 unusual transaction
4. ₹95,000 obligation due in five days
5. ₹3,00,000 growth opportunity

Each event updates business state, health, and the activity log. Use **WHY?** to inspect the recommendation. Before an important action is recorded, FinCrew asks for explicit owner approval. The What-if tool estimates scenarios without changing the business.

## Voice assistant

Open **FinCrew AI** or [http://localhost:5000/FinCrew.html](http://localhost:5000/FinCrew.html). Tap **TALK TO FINCREW**, grant microphone permission, and ask a question. Speech recognition depends on browser support and may require a secure context; `localhost` is supported in current Chrome and Edge. If speech recognition is unavailable or permission is denied, use the text chat. Speech synthesis is used when the browser supports it.

## Project architecture

- `index.html`, `FinCrew.html`, and `fincrew-game.html` load the shared vanilla JavaScript application for the dashboard, assistant, and judge-focused simulation.
- `app.js` renders the pages, calls the backend API, manages chat and speech, and requires confirmation before actions.
- `style.css` provides the responsive, light fintech interface.
- `server.py` owns business state, event detection, financial calculations, deterministic reasoning, optional API requests, approvals, and audit logging.
- `requirements.txt` lists the Python dependencies; `.env.example` documents optional server configuration.

## Demo flow

1. Dashboard: show health, cash, priorities, and the business context.
2. FinCrew AI: ask a question, enable Simple Mode, and try voice where available.
3. Simulation: start the event sequence, inspect **WHY?**, approve or cancel actions, run a What-if, and finish with the activity log.
