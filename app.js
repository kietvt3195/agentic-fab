import { computeEngineeringBom, runCutListFfd } from "./site-actions.js";
import { AgenticWebRuntime } from "./runtime.js";

const state = {
  length_mm: 1400,
  width_mm: 700,
  height_mm: 750,
  profile_id: "4040-Heavy",
  load_kg: 180,
  stock_length_mm: 6000,
  qty: 1,
  include_top: true,
  include_casters: true
};

let lang = "en";

const I18N = {
  en: {
    brand_sub: "Open Agentic Web MVP 0.3 • Structural Frame Co-Designer",
    btn_byok: "BYOK / LLM Config",
    btn_peer: "Peer Loader",
    wb_title: "Live Engineering Workbench",
    btn_csv: "Export BOM CSV",
    btn_rfq: "Sign RFQ (SHA-256)",
    ctrl_title: "Frame & Load Parameters",
    lbl_len: "Length L (mm)",
    lbl_wid: "Width W (mm)",
    lbl_hei: "Height H (mm)",
    lbl_load: "Distributed Load (kg)",
    lbl_profile: "Structural Profile",
    lbl_stock: "Stock Bar Length",
    lbl_qty: "Quantity (Units)",
    lbl_top: "18mm Tabletop",
    lbl_casters: "4x Locking Casters",
    bp_title: "Live Isometric Blueprint & Deflection",
    cut_title: "1D Cut-List Bin-Packing (First-Fit Decreasing, 3mm Kerf)",
    bom_title: "Itemized Bill of Materials (BOM)",
    col_item: "Item / Cut",
    col_spec: "Spec",
    col_cost: "Est. Cost",
    ag_title: "Open Agentic Web Console",
    ag_samples_lbl: "Sample Queries (Click to Run Multi-Agent Pipeline):",
    ag_trace_title: "Multi-Agent Execution Trace (JSON-Defined Network)",
    ag_trace_empty: "Run a query above to inspect agent delegations, schema validations, and tool effects (READ / WRITE / IRREVERSIBLE).",
    ag_send: "Run"
  },
  vi: {
    brand_sub: "Open Agentic Web MVP 0.3 • Đồng Thiết Kế Khung Công Nghiệp",
    btn_byok: "Cấu hình BYOK LLM",
    btn_peer: "Kiểm tra Peer",
    wb_title: "Bàn Thiết Kế Kỹ Thuật Trực Tiếp",
    btn_csv: "Xuất BOM CSV",
    btn_rfq: "Ký Báo Giá RFQ (SHA-256)",
    ctrl_title: "Thông số Khung & Tải trọng",
    lbl_len: "Chiều dài L (mm)",
    lbl_wid: "Chiều rộng W (mm)",
    lbl_hei: "Chiều cao H (mm)",
    lbl_load: "Tải phân bố (kg)",
    lbl_profile: "Thanh vật liệu",
    lbl_stock: "Chiều dài cây nguyên",
    lbl_qty: "Số lượng (bàn)",
    lbl_top: "Mặt bàn 18mm",
    lbl_casters: "4x Bánh xe khóa",
    bp_title: "Bản vẽ Isometric & Độ võng dầm",
    cut_title: "Tối ưu Cắt Thép/Nhôm 1D (First-Fit Decreasing, Mạch cắt 3mm)",
    bom_title: "Bảng Kê Vật Tư Chi Tiết (BOM)",
    col_item: "Hạng mục",
    col_spec: "Thông số",
    col_cost: "Thành tiền",
    ag_title: "Bảng Điều Khiển Mạng Agent Mở",
    ag_samples_lbl: "Câu hỏi mẫu (Bấm để chạy đa tác tử):",
    ag_trace_title: "Nhật ký Thực thi Đa Tác Tử (JSON Network)",
    ag_trace_empty: "Chạy một câu hỏi ở trên để xem agent gọi công cụ và kiểm soát hiệu ứng READ / WRITE / IRREVERSIBLE.",
    ag_send: "Chạy"
  }
};

function renderBlueprint(bom) {
  const svg = document.getElementById("svgBlueprint");
  const { length_mm: L, width_mm: W, height_mm: H } = bom.inputs;
  const pass = bom.metrics.safety_status === "PASS";
  const stroke = pass ? "#34d399" : "#fb7185";
  const scale = 0.085;
  const dx = L * scale * 0.85;
  const dy = L * scale * 0.25;
  const wx = W * scale * 0.65;
  const wy = W * scale * 0.38;
  const hz = H * scale * 0.95;

  const ox = 85;
  const oy = 95;
  const p0 = [ox, oy];
  const p1 = [ox + dx, oy - dy];
  const p2 = [ox + dx + wx, oy - dy + wy];
  const p3 = [ox + wx, oy + wy];

  const b0 = [p0[0], p0[1] + hz];
  const b1 = [p1[0], p1[1] + hz];
  const b2 = [p2[0], p2[1] + hz];
  const b3 = [p3[0], p3[1] + hz];

  const line = (a, b, col = stroke, w = 2.6) =>
    `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;

  svg.innerHTML = `
    <polygon points="${p0.join(",")} ${p1.join(",")} ${p2.join(",")} ${p3.join(",")}" fill="${pass ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.14)"}" stroke="${stroke}" stroke-width="1.5"/>
    ${line(p0, b0)} ${line(p1, b1)} ${line(p2, b2)} ${line(p3, b3)}
    ${line(b0, b3, "#64748b", 1.8)} ${line(b3, b2, "#64748b", 1.8)}
    ${line(b0, b1, "#475569", 1.2)} ${line(b1, b2, "#475569", 1.2)}
    <text x="${((p0[0] + p1[0]) / 2).toFixed(1)}" y="${((p0[1] + p1[1]) / 2 - 10).toFixed(1)}" fill="#e2e8f0" font-size="11" font-weight="700" text-anchor="middle">L = ${L}mm</text>
    <text x="${((p2[0] + p3[0]) / 2 + 18).toFixed(1)}" y="${((p2[1] + p3[1]) / 2 + 16).toFixed(1)}" fill="#a5b4fc" font-size="11" font-weight="700">W = ${W}mm</text>
    <text x="${(b3[0] - 48).toFixed(1)}" y="${((p3[1] + b3[1]) / 2).toFixed(1)}" fill="#fcd34d" font-size="11" font-weight="700">H = ${H}mm</text>
    <text x="14" y="22" fill="#94a3b8" font-size="11" font-weight="700">${bom.profile.id} • ${bom.inputs.load_kg} kg load</text>
  `;
}

function renderWorkbench() {
  const bom = computeEngineeringBom(state);
  const cut = runCutListFfd(state);

  document.getElementById("valLen").textContent = `${state.length_mm} mm`;
  document.getElementById("valWid").textContent = `${state.width_mm} mm`;
  document.getElementById("valHei").textContent = `${state.height_mm} mm`;
  document.getElementById("valLoad").textContent = `${state.load_kg} kg`;

  renderBlueprint(bom);

  const badge = document.getElementById("safetyBadge");
  const isPass = bom.metrics.safety_status === "PASS";
  badge.textContent = isPass ? "PASS" : "UPGRADE RECOMMENDED";
  badge.title = bom.metrics.safety_status;
  badge.className = `safety-badge ${isPass ? "pass" : "warn"}`;

  document.getElementById("safetyDetail").innerHTML =
    `Mid-span deflection: <strong>${bom.metrics.deflection_mm} mm</strong> vs L/300 limit <strong>${bom.metrics.limit_L300_mm} mm</strong> (${bom.metrics.utilization_ratio_pct}%) • Frame mass: <strong>${bom.metrics.frame_mass_kg} kg</strong>`;

  // Cut-list bars
  const cutListEl = document.getElementById("cutBarsList");
  const cutSumEl = document.getElementById("cutSummary");
  if (!cut.ok) {
    cutSumEl.textContent = cut.reason;
    cutListEl.innerHTML = `<div class="muted-meta">${cut.reason}</div>`;
  } else {
    cutSumEl.textContent = `${cut.total_bars_needed} × ${cut.stock_length_mm}mm bars • ${cut.utilization_pct}% used • ${cut.scrap_mm}mm scrap`;
    cutListEl.innerHTML = cut.bars
      .map((b) => {
        const segs = b.cuts
          .map((c) => {
            const pct = (c.len / cut.stock_length_mm) * 100;
            const cls = c.type === "Leg" ? "seg-leg" : c.type === "Long Rail" ? "seg-long" : "seg-cross";
            return `<div class="cut-seg ${cls}" style="width:${pct.toFixed(2)}%" title="${c.type}: ${c.len}mm">${pct > 10 ? c.len : ""}</div>`;
          })
          .join("");
        const scrapPct = Math.max(0, (b.scrap_mm / cut.stock_length_mm) * 100);
        return `
          <div class="bar-row">
            <span class="bar-lbl">Bar #${b.bar}</span>
            <div class="bar-track">
              ${segs}
              ${scrapPct > 2 ? `<div class="cut-scrap" style="width:${scrapPct.toFixed(2)}%">${b.scrap_mm}</div>` : ""}
            </div>
          </div>
        `;
      })
      .join("");
  }

  // BOM Table
  const rows = [
    ...bom.cuts_per_unit.map((c) => ({
      item: `${c.label} (${bom.profile.id})`,
      spec: `${c.length_mm}mm × ${c.count * bom.inputs.qty} pcs`,
      cost: "-"
    })),
    {
      item: `Total Profile Length`,
      spec: `${bom.metrics.total_profile_m} m`,
      cost: `$${bom.pricing.profile_usd.toFixed(2)}`
    },
    {
      item: `Brackets, T-Nuts & M8 Bolts`,
      spec: `${bom.hardware.corner_brackets} brackets / ${bom.hardware.t_nuts} nuts`,
      cost: `$${bom.pricing.hardware_usd.toFixed(2)}`
    }
  ];
  if (state.include_top) {
    rows.push({ item: `18mm Industrial Tabletop`, spec: `${bom.metrics.area_m2_per_unit} m² × ${bom.inputs.qty}`, cost: `$${bom.pricing.tabletop_usd.toFixed(2)}` });
  }
  if (state.include_casters) {
    rows.push({ item: `Locking Heavy-Duty Casters`, spec: `${bom.hardware.casters_or_feet} pcs`, cost: `$${bom.pricing.casters_usd.toFixed(2)}` });
  }
  if (bom.pricing.discount_usd > 0) {
    rows.push({ item: `Bulk Discount (${bom.pricing.discount_pct}%)`, spec: `Qty >= 3`, cost: `-$${bom.pricing.discount_usd.toFixed(2)}` });
  }

  document.getElementById("bomRows").innerHTML = rows
    .map((r) => `<tr><td>${r.item}</td><td>${r.spec}</td><td>${r.cost}</td></tr>`)
    .join("");
  document.getElementById("bomTotalUsd").textContent = `$${bom.pricing.total_usd.toFixed(2)}`;
  document.getElementById("bomTotalVnd").textContent = `${bom.pricing.total_vnd.toLocaleString("en-US")} VNĐ`;
}

function formatAgentText(text) {
  const escaped = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function appendChat(role, text) {
  const feed = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  if (role === "agent") {
    div.innerHTML = formatAgentText(text);
  } else {
    div.textContent = text;
  }
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function renderTrace(traceLog, stepCount) {
  document.getElementById("traceStepCount").textContent = `Steps: ${stepCount} / 12`;
  const list = document.getElementById("traceList");
  if (!traceLog || traceLog.length === 0) return;
  list.innerHTML = traceLog
    .map((t) => {
      const effCls = t.effect === "irreversible" ? "eff-irreversible" : t.effect === "write" ? "eff-write" : "eff-read";
      const okTag = t.result?.status || "ok";
      return `
        <div class="trace-item">
          <div><strong>#${t.step} ${t.agent}</strong> → <code>${t.tool}</code> <span class="muted-meta">(${okTag})</span></div>
          <span class="eff-badge ${effCls}">${t.effect.toUpperCase()}</span>
        </div>
      `;
    })
    .join("");
}

function showConfirmModal({ actionName, destination, args }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modalConfirm");
    document.getElementById("confirmActionName").textContent = actionName;
    document.getElementById("confirmOrigin").textContent = destination;
    document.getElementById("confirmArgs").textContent = JSON.stringify(args, null, 2);
    modal.style.display = "flex";

    const yesBtn = document.getElementById("btnConfirmYes");
    const noBtn = document.getElementById("btnConfirmNo");
    const cleanup = (val) => {
      modal.style.display = "none";
      yesBtn.onclick = null;
      noBtn.onclick = null;
      resolve(val);
    };
    yesBtn.onclick = () => cleanup(true);
    noBtn.onclick = () => cleanup(false);
  });
}

function showOriginConsentModal({ origin, manifestUrl, requestedNetwork }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modalOrigin");
    document.getElementById("originTarget").textContent = origin;
    document.getElementById("originManifestUrl").textContent = manifestUrl;
    document.getElementById("originNetworkName").textContent = requestedNetwork;
    modal.style.display = "flex";

    const yesBtn = document.getElementById("btnOriginYes");
    const noBtn = document.getElementById("btnOriginNo");
    const cleanup = (val) => {
      modal.style.display = "none";
      yesBtn.onclick = null;
      noBtn.onclick = null;
      resolve(val);
    };
    yesBtn.onclick = () => cleanup(true);
    noBtn.onclick = () => cleanup(false);
  });
}

function syncControlInputs() {
  document.getElementById("inpLen").value = state.length_mm;
  document.getElementById("inpWid").value = state.width_mm;
  document.getElementById("inpHei").value = state.height_mm;
  document.getElementById("inpLoad").value = state.load_kg;
  document.getElementById("selProfile").value = state.profile_id;
  document.getElementById("selStock").value = String(state.stock_length_mm);
  document.getElementById("inpQty").value = state.qty;
}

const uiBridge = {
  applyParams: (args) => {
    if (args.length_mm !== undefined) state.length_mm = Number(args.length_mm);
    if (args.width_mm !== undefined) state.width_mm = Number(args.width_mm);
    if (args.height_mm !== undefined) state.height_mm = Number(args.height_mm);
    if (args.profile_id) state.profile_id = args.profile_id;
    if (args.load_kg !== undefined) state.load_kg = Number(args.load_kg);
    if (args.stock_length_mm !== undefined) state.stock_length_mm = Number(args.stock_length_mm);
    if (args.qty !== undefined) state.qty = Number(args.qty);
    syncControlInputs();
    renderWorkbench();
    return { ok: true, synced_state: { ...state } };
  },
  onRfqIssued: (receipt) => {
    const box = document.getElementById("rfqBox");
    box.style.display = "block";
    box.innerHTML =
      `<strong>Signed RFQ Receipt: ${receipt.rfq_id}</strong> (${receipt.issued_at})<br/>` +
      `Config: ${receipt.bom_summary.dimensions_mm}mm • ${receipt.bom_summary.profile} × ${receipt.bom_summary.qty} • Total: <strong>$${receipt.bom_summary.total_usd}</strong><br/>` +
      `SHA-256: <code>${receipt.sha256}</code>`;
  }
};

const runtime = new AgenticWebRuntime({
  uiBridge,
  requestConfirmation: showConfirmModal,
  requestOriginConsent: showOriginConsentModal
});

async function handleQuery(text) {
  if (!text.trim()) return;
  appendChat("user", text);
  const res = await runtime.runQuery(text, state);
  appendChat("agent", res.reply);
  renderTrace(res.traceLog, res.stepCount);
}

function applyLang(next) {
  lang = next;
  const dict = I18N[lang];
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (dict[k]) el.textContent = dict[k];
  });
}

function refreshByokBadge() {
  const b = document.getElementById("byokModeBadge");
  b.textContent =
    runtime.byok.mode === "byok" && runtime.byok.apiKey
      ? `Mode: BYOK (${runtime.byok.model})`
      : "Mode: Zero-Key Local Engine (Ready)";
}

document.addEventListener("DOMContentLoaded", async () => {
  renderWorkbench();
  refreshByokBadge();

  try {
    const { manifest } = await runtime.init();
    document.getElementById("specStatusBadge").textContent = "MVP 0.3 Manifest Valid";
    const queries = manifest.networks?.[0]?.sample_queries || [];
    const sqEl = document.getElementById("sampleQueries");
    sqEl.innerHTML = queries
      .map((q) => `<button type="button" class="sample-btn">${q}</button>`)
      .join("");
    sqEl.querySelectorAll(".sample-btn").forEach((btn) => {
      btn.addEventListener("click", () => handleQuery(btn.textContent));
    });
    appendChat(
      "agent",
      "AgenticFab runtime initialized (agent-manifest.json + agentic_fab.network.json loaded). Ask a structural engineering question or click any sample query above."
    );
  } catch (err) {
    document.getElementById("specStatusBadge").textContent = `Init Error: ${err.message}`;
  }

  // Workbench listeners
  const bindRange = (id, key) => {
    document.getElementById(id).addEventListener("input", (e) => {
      state[key] = Number(e.target.value);
      renderWorkbench();
    });
  };
  bindRange("inpLen", "length_mm");
  bindRange("inpWid", "width_mm");
  bindRange("inpHei", "height_mm");
  bindRange("inpLoad", "load_kg");

  document.getElementById("selProfile").addEventListener("change", (e) => {
    state.profile_id = e.target.value;
    renderWorkbench();
  });
  document.getElementById("selStock").addEventListener("change", (e) => {
    state.stock_length_mm = Number(e.target.value);
    renderWorkbench();
  });
  document.getElementById("inpQty").addEventListener("input", (e) => {
    state.qty = Math.max(1, Number(e.target.value) || 1);
    renderWorkbench();
  });
  document.getElementById("chkTop").addEventListener("change", (e) => {
    state.include_top = e.target.checked;
    renderWorkbench();
  });
  document.getElementById("chkCasters").addEventListener("change", (e) => {
    state.include_casters = e.target.checked;
    renderWorkbench();
  });

  // Export CSV
  document.getElementById("btnExportCsv").addEventListener("click", () => {
    const bom = computeEngineeringBom(state);
    const lines = [
      "Category,Spec,Value",
      `Profile,${bom.profile.id},${bom.metrics.total_profile_m} m ($${bom.pricing.profile_usd})`,
      `Hardware,"${bom.hardware.corner_brackets} brackets / ${bom.hardware.t_nuts} T-nuts",$${bom.pricing.hardware_usd}`,
      `Deflection,${bom.metrics.deflection_mm} mm vs ${bom.metrics.limit_L300_mm} mm,${bom.metrics.safety_status}`,
      `Total,Qty ${bom.inputs.qty},$${bom.pricing.total_usd}`
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenticfab_bom_${state.profile_id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Trigger Irreversible Signed RFQ directly
  document.getElementById("btnTriggerRfq").addEventListener("click", () => {
    handleQuery(
      `Issue a SHA-256 signed RFQ for ${state.qty} tables at ${state.length_mm}x${state.width_mm}x${state.height_mm}mm ${state.profile_id} with ${state.load_kg}kg load`
    );
  });

  // Agent form
  document.getElementById("agentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = document.getElementById("agentInput");
    const txt = inp.value.trim();
    if (!txt) return;
    inp.value = "";
    handleQuery(txt);
  });

  // Lang toggle
  document.getElementById("btnLang").addEventListener("click", () => {
    applyLang(lang === "en" ? "vi" : "en");
  });

  // BYOK Modal
  document.getElementById("btnByok").addEventListener("click", () => {
    document.getElementById("byokMode").value = runtime.byok.mode;
    document.getElementById("byokUrl").value = runtime.byok.baseUrl;
    document.getElementById("byokModel").value = runtime.byok.model;
    document.getElementById("byokKey").value = runtime.byok.apiKey;
    document.getElementById("modalByok").style.display = "flex";
  });
  document.getElementById("btnCloseByok").addEventListener("click", () => {
    document.getElementById("modalByok").style.display = "none";
  });
  document.getElementById("btnSaveByok").addEventListener("click", () => {
    runtime.saveByokConfig({
      mode: document.getElementById("byokMode").value,
      baseUrl: document.getElementById("byokUrl").value.trim(),
      model: document.getElementById("byokModel").value.trim(),
      apiKey: document.getElementById("byokKey").value.trim()
    });
    refreshByokBadge();
    document.getElementById("modalByok").style.display = "none";
  });

  // Peer Modal
  document.getElementById("btnPeer").addEventListener("click", () => {
    document.getElementById("modalPeer").style.display = "flex";
  });
  document.getElementById("btnClosePeer").addEventListener("click", () => {
    document.getElementById("modalPeer").style.display = "none";
  });
  document.getElementById("btnLoadPeer").addEventListener("click", async () => {
    const out = document.getElementById("peerResult");
    out.textContent = "Requesting consent & fetching peer agent-manifest.json...";
    try {
      const res = await runtime.inspectPeerNetwork(document.getElementById("peerUrlInput").value);
      out.textContent = JSON.stringify(res, null, 2);
    } catch (err) {
      out.textContent = `Peer check failed: ${err.message}`;
    }
  });
});
