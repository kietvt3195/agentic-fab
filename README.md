# AgenticFab — Open Agentic Web Structural Frame Co-Designer

> Built for **The Open Agentic Web Challenge** (`cognizant-agenticweb.devpost.com`), conforming to `cognizant-ai-labs/agentic-web` **MVP Profile 0.3**.

**Live Site:** [https://kietvt3195.github.io/agentic-fab/](https://kietvt3195.github.io/agentic-fab/)

---

## What It Does
**AgenticFab** transforms a static industrial workbench & 4040/4080 aluminum/steel frame estimator into an interoperable **Open Agentic Web** site:

1. **JSON-Defined Multi-Agent Network (`agentic_fab.network.json`):**
   - `agentic_fab_frontman`: Coordinates user requests across specialized sub-agents (`max_steps: 12`).
   - `structural_bom_agent`: Computes exact member cuts, hardware BOM, and **Euler-Bernoulli mid-span beam deflection** vs. the `L/300` stiffness criterion (automatically testing `4080-Heavy` / `Steel-40x40x2` when a profile fails).
   - `cutlist_optimizer_agent`: Runs **First-Fit Decreasing (FFD)** 1D bin-packing across `6000mm` or `2000mm` stock bars with a `3mm` saw kerf to minimize waste.
   - `quote_compliance_agent`: Issues a tamper-evident **SHA-256 signed RFQ receipt** (`crypto.subtle.digest`) strictly behind a mandatory confirmation gate.
2. **Browser-Only Execution & Pluggable BYOK (`runtime.js`):**
   - Runs 100% client-side in standard HTML/CSS/ES Modules with zero server-side code.
   - Supports **Bring Your Own Key (BYOK)** for any OpenAI-compatible router (Mozilla Otari `https://api.otari.ai/api/v1`, OpenAI, OpenRouter) stored in `sessionStorage` only, **plus** a zero-key deterministic local engine so anyone can evaluate multi-agent tool calls immediately.
3. **Consent-Gated Security & Effects (`site-actions.js`):**
   - Actions declare `read`, `write`, or `irreversible` effects with JSON Schema validation.
   - `issue_signed_rfq` (`irreversible`) forces an explicit visitor confirmation dialog before running.
   - Peer loading prompts explicit origin consent before fetching external `agent-manifest.json` files and never forwards visitor keys.

---

## Public Open Agentic Web Files
- `agent-manifest.json` — MVP Profile 0.3 manifest
- `agentic_fab.network.json` — Portable Neuro SAN JSON agent network
- `.well-known/agent.json` — A2A Agent Card
- `.well-known/nsdeploy-agent.json` — nsdeploy descriptor
- `llms.txt` — Machine-readable summary
- `site-actions.js` & `runtime.js` — Browser runtime & typed action registry

## Run Locally
```bash
python -m http.server 8080
```
Open `http://localhost:8080`.

## License
MIT
