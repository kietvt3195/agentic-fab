// Browser-Only Open Agentic Web Runtime (MVP Profile 0.3)
// - Loads & validates ./agent-manifest.json and ./agentic_fab.network.json
// - Validates action schemas and enforces mandatory visitor confirmation for `irreversible` effects
// - Supports pluggable BYOK OpenAI-compatible inference (sessionStorage only) + Zero-Key Local Agent Engine
// - Implements Consent-Gated Peer Site Loading without ever forwarding visitor keys to peer origins

import { SiteActions, PROFILES } from "./site-actions.js";

export class ActionRegistry {
  constructor() {
    this.actions = new Map();
  }

  register(def) {
    if (!def || !def.name || typeof def.execute !== "function") {
      throw new Error("Invalid site action definition");
    }
    this.actions.set(def.name, def);
  }

  list() {
    return Array.from(this.actions.values());
  }

  get(name) {
    return this.actions.get(name);
  }

  validateArgs(schema, args) {
    if (!schema || schema.type !== "object") return { ok: true };
    const props = schema.properties || {};
    const required = schema.required || [];
    const input = args || {};

    for (const reqKey of required) {
      if (input[reqKey] === undefined || input[reqKey] === null || input[reqKey] === "") {
        return { ok: false, reason: `Missing required parameter: ${reqKey}` };
      }
    }
    for (const [k, val] of Object.entries(input)) {
      const rule = props[k];
      if (!rule) continue;
      if (rule.type === "number") {
        const num = Number(val);
        if (!Number.isFinite(num)) return { ok: false, reason: `${k} must be a valid number.` };
        if (rule.minimum !== undefined && num < rule.minimum) return { ok: false, reason: `${k} must be >= ${rule.minimum}.` };
        if (rule.maximum !== undefined && num > rule.maximum) return { ok: false, reason: `${k} must be <= ${rule.maximum}.` };
      }
      if (rule.enum && !rule.enum.includes(val)) {
        return { ok: false, reason: `${k} must be one of: ${rule.enum.join(", ")}` };
      }
    }
    return { ok: true };
  }
}

export class AgenticWebRuntime {
  constructor({ uiBridge, requestConfirmation, requestOriginConsent }) {
    this.registry = new ActionRegistry();
    this.uiBridge = uiBridge;
    this.requestConfirmation = requestConfirmation;
    this.requestOriginConsent = requestOriginConsent;
    this.manifest = null;
    this.network = null;
    this.maxSteps = 12;
    this.byok = this.loadByokConfig();
  }

  loadByokConfig() {
    try {
      const raw = sessionStorage.getItem("agentic_fab_byok");
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore storage errors
    }
    return {
      mode: "local", // "local" (Zero-Key Engine) | "byok" (OpenAI-compatible router)
      baseUrl: "https://api.otari.ai/api/v1",
      model: "gpt-4o-mini",
      apiKey: ""
    };
  }

  saveByokConfig(cfg) {
    this.byok = { ...this.byok, ...cfg };
    try {
      sessionStorage.setItem("agentic_fab_byok", JSON.stringify(this.byok));
    } catch {
      // ignore storage errors
    }
  }

  async init() {
    const [mRes, nRes] = await Promise.all([
      fetch("./agent-manifest.json"),
      fetch("./agentic_fab.network.json")
    ]);
    if (!mRes.ok) throw new Error(`Failed to fetch agent-manifest.json (${mRes.status})`);
    if (!nRes.ok) throw new Error(`Failed to fetch agentic_fab.network.json (${nRes.status})`);

    this.manifest = await mRes.json();
    this.network = await nRes.json();
    this.maxSteps = Number(this.network.max_steps) || 12;

    SiteActions.registerActions(this.registry, this.uiBridge);
    return { manifest: this.manifest, network: this.network };
  }

  async executeTool(toolName, args, traceLog, stepCounter) {
    if (stepCounter.count >= this.maxSteps) {
      throw new Error(`Execution budget exceeded (max_steps=${this.maxSteps})`);
    }
    stepCounter.count += 1;
    const action = this.registry.get(toolName);
    if (!action) {
      const errRes = { status: "error", message: `Unknown tool: ${toolName}` };
      traceLog.push({ step: stepCounter.count, agent: "runtime", tool: `website_${toolName}`, effect: "read", args, result: errRes });
      return errRes;
    }

    const valid = this.registry.validateArgs(action.inputSchema, args);
    if (!valid.ok) {
      const refuseRes = { status: "succeeded", ok: false, reason: valid.reason };
      traceLog.push({ step: stepCounter.count, agent: "runtime", tool: `website_${toolName}`, effect: action.effect, args, result: refuseRes });
      return refuseRes;
    }

    if (action.effect === "irreversible") {
      const approved = await this.requestConfirmation({
        actionName: `website_${toolName}`,
        destination: window.location.origin,
        description: action.description,
        args
      });
      if (!approved) {
        const cancelRes = { status: "cancelled", ok: false, reason: "Visitor declined irreversible operation." };
        traceLog.push({ step: stepCounter.count, agent: "quote_compliance_agent", tool: `website_${toolName}`, effect: "irreversible", args, result: cancelRes });
        return cancelRes;
      }
    }

    try {
      const output = await action.execute(args);
      const res = { status: "succeeded", ...output };
      const ownerAgent =
        toolName === "calculate_bom_and_deflection" ? "structural_bom_agent" :
        toolName === "optimize_cut_list" ? "cutlist_optimizer_agent" :
        toolName === "issue_signed_rfq" ? "quote_compliance_agent" :
        "agentic_fab_frontman";
      traceLog.push({ step: stepCounter.count, agent: ownerAgent, tool: `website_${toolName}`, effect: action.effect, args, result: res });
      return res;
    } catch (err) {
      const unkRes = { status: "unknown", ok: false, reason: err?.message || "Execution error" };
      traceLog.push({ step: stepCounter.count, agent: "runtime", tool: `website_${toolName}`, effect: action.effect, args, result: unkRes });
      return unkRes;
    }
  }

  parseRequestIntoParams(userText, currentState) {
    const text = userText.toLowerCase();
    const params = {
      length_mm: currentState.length_mm,
      width_mm: currentState.width_mm,
      height_mm: currentState.height_mm,
      profile_id: currentState.profile_id,
      load_kg: currentState.load_kg,
      stock_length_mm: currentState.stock_length_mm,
      qty: currentState.qty
    };

    // Extract LxWxH (e.g. 1600x800x750 or 1600 x 800 x 750)
    const dimMatch = text.match(/(\d{3,4})\s*[x×*]\s*(\d{3,4})(?:\s*[x×*]\s*(\d{3,4}))?/);
    if (dimMatch) {
      params.length_mm = Number(dimMatch[1]);
      params.width_mm = Number(dimMatch[2]);
      if (dimMatch[3]) params.height_mm = Number(dimMatch[3]);
    } else {
      const spanMatch = text.match(/(\d{3,4})\s*mm\s*span|span\s*(?:of\s*)?(\d{3,4})\s*mm|(\d{3,4})\s*mm/);
      if (spanMatch) {
        const val = Number(spanMatch[1] || spanMatch[2] || spanMatch[3]);
        if (val >= 600 && val <= 3000) params.length_mm = val;
      }
    }

    const loadMatch = text.match(/(\d{2,4})\s*kg/);
    if (loadMatch) params.load_kg = Number(loadMatch[1]);

    const qtyMatch = text.match(/(\d{1,2})\s*(?:tables?|units?|bàn|cái|khung)/);
    if (qtyMatch) params.qty = Number(qtyMatch[1]);

    if (text.includes("2000mm") && (text.includes("stock") || text.includes("bar") || text.includes("cây"))) {
      params.stock_length_mm = 2000;
    } else if (text.includes("6000mm")) {
      params.stock_length_mm = 6000;
    }

    if (text.includes("4040-light") || text.includes("4040 light")) params.profile_id = "4040-Light";
    else if (text.includes("4080")) params.profile_id = "4080-Heavy";
    else if (text.includes("steel") || text.includes("sắt")) params.profile_id = "Steel-40x40x2";
    else if (text.includes("4040")) params.profile_id = "4040-Heavy";

    const wantsRfq = /\b(rfq|sign|issue|quote receipt|xuất báo giá|ký rfq)\b/i.test(userText);
    const wantsCompare = /\b(compare|vs|so sánh)\b/i.test(userText);
    const wantsProfiles = /\b(list profiles|profiles|materials|vật liệu)\b/i.test(userText);

    return { params, wantsRfq, wantsCompare, wantsProfiles };
  }

  async runLocalMultiAgent(userText, currentState) {
    const traceLog = [];
    const stepCounter = { count: 0 };
    const { params, wantsRfq, wantsCompare, wantsProfiles } = this.parseRequestIntoParams(userText, currentState);

    if (wantsProfiles) {
      const profRes = await this.executeTool("list_profiles", {}, traceLog, stepCounter);
      const lines = profRes.profiles.map((p) => `• **${p.id}** (${p.crossSectionMm}mm): Ix=${p.ixCm4} cm⁴, E=${p.eGpa} GPa, $${p.priceUsdPerM}/m`);
      return {
        reply: `**agentic_fab_frontman** queried available structural profiles:\n${lines.join("\n")}`,
        traceLog,
        stepCount: stepCounter.count
      };
    }

    // 1. Structural BOM + Deflection
    const bomRes = await this.executeTool("calculate_bom_and_deflection", params, traceLog, stepCounter);
    let upgradeNote = "";
    let finalParams = { ...params };

    // Auto-check 4080-Heavy if deflection fails L/300 OR if user asked to compare
    if (bomRes.metrics?.safety_status !== "PASS" || wantsCompare) {
      const altId = params.profile_id === "4080-Heavy" ? "Steel-40x40x2" : "4080-Heavy";
      const altBom = await this.executeTool(
        "calculate_bom_and_deflection",
        { ...params, profile_id: altId },
        traceLog,
        stepCounter
      );
      if (bomRes.metrics?.safety_status !== "PASS" && altBom.metrics?.safety_status === "PASS") {
        upgradeNote = `\n\n⚠️ **Safety Auto-Check:** \`${params.profile_id}\` deflects **${bomRes.metrics.deflection_mm} mm** (exceeds L/300 limit of **${bomRes.metrics.limit_L300_mm} mm**). Delegated comparison to \`${altId}\`: deflection drops to **${altBom.metrics.deflection_mm} mm (PASS)** at **$${altBom.pricing.total_usd}**.`;
        if (!userText.toLowerCase().includes("check if")) {
          finalParams.profile_id = altId;
        }
      } else if (wantsCompare) {
        upgradeNote = `\n\n**Profile Comparison (${altId}):** Deflection **${altBom.metrics.deflection_mm} mm** (${altBom.metrics.safety_status}) • Est. Total **$${altBom.pricing.total_usd}**.`;
      }
    }

    // 2. Cut-list optimization
    const cutRes = await this.executeTool("optimize_cut_list", finalParams, traceLog, stepCounter);

    // 3. Apply to live workbench UI (write effect)
    await this.executeTool("apply_to_workbench", finalParams, traceLog, stepCounter);

    // 4. Optional irreversible signed RFQ
    let rfqNote = "";
    if (wantsRfq) {
      const rfqRes = await this.executeTool(
        "issue_signed_rfq",
        { ...finalParams, customer_name: "Workshop Visitor" },
        traceLog,
        stepCounter
      );
      if (rfqRes.status === "succeeded" && rfqRes.sha256) {
        rfqNote = `\n\n✅ **Signed RFQ Issued:** \`${rfqRes.rfq_id}\`\n• **SHA-256:** \`${rfqRes.sha256.slice(0, 24)}...\`\n• **Verified Total:** $${rfqRes.bom_summary.total_usd} (${rfqRes.bom_summary.total_vnd.toLocaleString("en-US")} VNĐ)`;
      } else if (rfqRes.status === "cancelled") {
        rfqNote = `\n\n🛑 **RFQ Cancelled:** Visitor declined the irreversible signing confirmation.`;
      }
    }

    const activeBom = finalParams.profile_id === params.profile_id ? bomRes : await this.executeTool("calculate_bom_and_deflection", finalParams, traceLog, stepCounter);
    const cutText = cutRes.ok
      ? `**${cutRes.total_bars_needed} × ${cutRes.stock_length_mm}mm bars** (${cutRes.utilization_pct}% utilization, ${cutRes.scrap_mm}mm scrap across ${cutRes.total_cuts} cuts)`
      : `⚠️ ${cutRes.reason}`;

    const reply =
      `**Design Synced to Live Workbench (${finalParams.length_mm}×${finalParams.width_mm}×${finalParams.height_mm}mm • ${finalParams.profile_id} • Qty ${finalParams.qty}):**\n` +
      `• **Structural Safety (\`structural_bom_agent\`):** Mid-span deflection **${activeBom.metrics.deflection_mm} mm** vs L/300 limit **${activeBom.metrics.limit_L300_mm} mm** → **${activeBom.metrics.safety_status}**\n` +
      `• **Cut-List Optimizer (\`cutlist_optimizer_agent\`):** ${cutText}\n` +
      `• **Estimated BOM Total:** **$${activeBom.pricing.total_usd}** (${activeBom.pricing.total_vnd.toLocaleString("en-US")} VNĐ)` +
      upgradeNote +
      rfqNote;

    return { reply, traceLog, stepCount: stepCounter.count };
  }

  async runByokInference(userText, currentState) {
    const traceLog = [];
    const stepCounter = { count: 0 };
    const endpoint = this.byok.baseUrl.replace(/\/+$/, "") + "/chat/completions";

    const tools = this.registry.list().map((act) => ({
      type: "function",
      function: {
        name: `website_${act.name}`,
        description: `[effect: ${act.effect}] ${act.description}`,
        parameters: act.inputSchema
      }
    }));

    const messages = [
      {
        role: "system",
        content:
          `You are AgenticFab frontman running inside a browser Open Agentic Web runtime (MVP Profile 0.3). ` +
          `Current workbench state: ${JSON.stringify(currentState)}. ` +
          `Always use website_* tools to compute real BOMs, check L/300 deflection, optimize FFD cut lists, and sync to workbench. Never invent numbers.`
      },
      { role: "user", content: userText }
    ];

    for (let turn = 0; turn < 6; turn++) {
      if (stepCounter.count >= this.maxSteps) break;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.byok.apiKey}`
        },
        body: JSON.stringify({
          model: this.byok.model || "gpt-4o-mini",
          messages,
          tools,
          temperature: 0.1
        })
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`BYOK Router HTTP ${res.status}: ${errBody.slice(0, 180)}`);
      }
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("Empty response from BYOK router");
      messages.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return { reply: msg.content || "Done.", traceLog, stepCount: stepCounter.count };
      }

      for (const tc of msg.tool_calls) {
        const rawName = tc.function.name.replace(/^website_/, "");
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          parsedArgs = {};
        }
        const toolOut = await this.executeTool(rawName, parsedArgs, traceLog, stepCounter);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolOut)
        });
      }
    }

    return { reply: "Completed within step budget.", traceLog, stepCount: stepCounter.count };
  }

  async runQuery(userText, currentState) {
    if (this.byok.mode === "byok" && this.byok.apiKey.trim()) {
      try {
        return await this.runByokInference(userText, currentState);
      } catch (err) {
        const fallback = await this.runLocalMultiAgent(userText, currentState);
        fallback.reply = `⚠️ *BYOK Router fallback (${err.message}) — executed via browser deterministic engine:*\n\n` + fallback.reply;
        return fallback;
      }
    }
    return this.runLocalMultiAgent(userText, currentState);
  }

  async inspectPeerNetwork(peerUrlInput) {
    const clean = peerUrlInput.trim().replace(/\/+$/, "");
    const parsed = new URL(clean);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const requestedNet = segments.length > 0 ? segments[segments.length - 1] : "";
    const basePath = segments.length > 1 ? "/" + segments.slice(0, -1).join("/") : "";
    const manifestUrl = `${parsed.origin}${basePath}/agent-manifest.json`;

    const approved = await this.requestOriginConsent({
      origin: parsed.origin,
      manifestUrl,
      requestedNetwork: requestedNet || "(index)"
    });
    if (!approved) {
      return { ok: false, cancelled: true, reason: "Visitor declined third-party origin contact." };
    }

    // Never forward visitor BYOK credentials to peer origins
    const res = await fetch(manifestUrl, { mode: "cors", credentials: "omit" });
    if (!res.ok) {
      return { ok: false, reason: `Peer manifest HTTP ${res.status} at ${manifestUrl}` };
    }
    const peerManifest = await res.json();
    const matched = requestedNet
      ? (peerManifest.networks || []).find((n) => n.name === requestedNet)
      : (peerManifest.networks || [])[0];

    if (requestedNet && !matched) {
      return { ok: false, reason: `Requested network "${requestedNet}" not found in peer's agent-manifest.json.` };
    }

    return {
      ok: true,
      origin: parsed.origin,
      manifestUrl,
      brand: peerManifest.brand || parsed.origin,
      network: matched,
      allowed_peers: peerManifest.allowed_peers || []
    };
  }
}
