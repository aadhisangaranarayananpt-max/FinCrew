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

The home page is **Cashflow Racer**, a light-theme 3D driving game built with Vite + Three.js. Press **Space** to start or pause, and steer between three lanes with **← / →** or **A / D** (or use the on-screen controls on touch screens). Collect gold cash tokens and avoid expense crates to protect your cash shield. Original Web Audio engine, cash pickup, and collision sounds play after the player starts the engine; use the speaker control to mute or restore them. The five connected financial missions, owner-approved decisions, Crews AI chat, and browser voice controls remain available in the game HUD; the classic 2D dashboard is still accessible.

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

`server.py` serves the frontend and provides the JSON API on `0.0.0.0:5000` by default, so other devices on the same network can reach it if the computer's firewall allows the connection. Set `PORT` in the environment to choose another port. For access from anywhere, publish the app using the Render steps above and use its HTTPS URL. The in-memory business state resets when the server restarts; the AI conversation history is saved locally in the browser.

## Optional AI API setup

The built-in deterministic FinCrew reasoning answers common questions using the current simulated business state. It requires no account, key, or internet connection.

An optional Anthropic API key enables external AI-generated answers:

1. Copy `.env.example` to `.env`.
2. Set `ANTHROPIC_API_KEY` in `.env`.
3. Restart the server.

The key is read only by the Python backend and must never be placed in browser files. If the API is unavailable or the key is missing, FinCrew continues to use local reasoning.

## Cashflow Rescue campaign

Start the finance rescue run from the 3D home page. The five-sector campaign puts the player in charge of responding to:

1. ₹85,000 late customer payment
2. ₹1,20,000 unexpected expense
3. ₹48,500 unusual transaction
4. ₹95,000 obligation due in five days
5. ₹3,00,000 growth opportunity

Each mission updates the simulated business, financial health, and activity log. The mission map, sector progress, and Mission XP update as events are resolved. Use **WHY?** to inspect a recommendation. Before an important action is recorded, FinCrew asks for explicit owner approval. The What-if tool estimates scenarios without changing the business. The driving game is a separate arcade run and does not perform financial actions. The previous simulation page remains available for compatibility.

## Voice assistant

On the 3D home page, tap **CALL CREWS AI once** and allow microphone access. After the status says the microphone is on, say **“Crews”** followed by your question, or say **“Crews”**, listen for the spoken acknowledgement, then ask when Crews AI says it is listening. Crews AI answers aloud and keeps listening for the wake word while you play or review the business; you do not need to press the microphone button for each question. Closing the chat panel does not turn off listening. Reopen it and press **STOP LISTENING** when you want the microphone off. On the classic business dashboard, use the **Call Crews** control in the top bar once to start the same hands-free wake-word flow; it remains available while you review dashboard sections, and the **Crews listening** control turns it off. Browser microphone permission and speech recognition support are required; use `localhost` or HTTPS with a supported browser such as current Chrome or Edge. Voice recognition may stop when the browser or page is suspended. Voice controls report microphone, connection, and browser errors; text chat remains available if voice is unavailable.

## Project architecture

- `index.html` loads the built 3D Cashflow Racer game; `FinCrew.html` and `fincrew-game.html` preserve the classic copilot and simulation pages.
- `app.js` renders the pages, calls the backend API, manages chat and speech, and requires confirmation before actions.
- `style.css` provides the responsive, light fintech interface.
- `server.py` owns business state, event detection, financial calculations, deterministic reasoning, optional API requests, approvals, and audit logging.
- `requirements.txt` lists the Python dependencies; `.env.example` documents optional server configuration.

## Demo flow

1. Dashboard: show health, cash, priorities, and the business context.
2. FinCrew AI: ask a question, enable Simple Mode, and try voice where available.
3. Cashflow Rescue: start the five-sector run, orbit the campus, inspect **WHY?**, approve or cancel decisions, and review the result in the Activity Log.
