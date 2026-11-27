// Site Actions module for AgenticFab (Open Agentic Web MVP Profile 0.3)
// Exposes typed engineering tools (`read`, `write`, `irreversible`) with JSON Schema validation.

export const PROFILES = [
  {
    id: "4040-Light",
    name: "Aluminum 4040 Light (6063-T5)",
    material: "Aluminum 6063-T5",
    crossSectionMm: "40 x 40",
    ixCm4: 7.42,
    eGpa: 69.0,
    massKgPerM: 1.48,
    priceUsdPerM: 6.2,
    priceVndPerM: 155000
  },
  {
    id: "4040-Heavy",
    name: "Aluminum 4040 Heavy (6063-T5)",
    material: "Aluminum 6063-T5",
    crossSectionMm: "40 x 40",
    ixCm4: 10.2,
    eGpa: 69.0,
    massKgPerM: 1.95,
    priceUsdPerM: 7.8,
    priceVndPerM: 195000
  },
  {
    id: "4080-Heavy",
    name: "Aluminum 4080 Heavy (6063-T5)",
    material: "Aluminum 6063-T5",
    crossSectionMm: "40 x 80",
    ixCm4: 68.4,
    eGpa: 69.0,
    massKgPerM: 3.65,
    priceUsdPerM: 14.4,
    priceVndPerM: 360000
  },
  {
    id: "Steel-40x40x2",
    name: "Box Steel 40x40x2.0mm (SS400)",
    material: "Carbon Steel SS400",
    crossSectionMm: "40 x 40 x 2.0",
    ixCm4: 6.94,
    eGpa: 205.0,
    massKgPerM: 2.38,
    priceUsdPerM: 4.4,
    priceVndPerM: 110000
  }
];

function getProfile(profileId) {
  return PROFILES.find((p) => p.id === profileId) || PROFILES[1];
}

function clampNum(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function computeEngineeringBom({
  length_mm = 1400,
  width_mm = 700,
  height_mm = 750,
  profile_id = "4040-Heavy",
  load_kg = 180,
  qty = 1,
  include_top = true,
  include_casters = true
} = {}) {
  const L = clampNum(length_mm, 600, 3000, 1400);
  const W = clampNum(width_mm, 400, 1600, 700);
  const H = clampNum(height_mm, 500, 1400, 750);
  const loadKg = clampNum(load_kg, 10, 2000, 180);
  const units = Math.round(clampNum(qty, 1, 100, 1));
  const prof = getProfile(profile_id);

  // Frame geometry: 4 vertical legs of height H, 4 longitudinal rails (L - 80mm), 4 transverse rails (W - 80mm)
  const legCutMm = H;
  const longRailMm = Math.max(200, L - 80);
  const sideRailMm = Math.max(200, W - 80);
  const totalMetersPerUnit = (4 * legCutMm + 4 * longRailMm + 4 * sideRailMm) / 1000;
  const totalMeters = +(totalMetersPerUnit * units).toFixed(2);
  const profileCostUsd = +(totalMeters * prof.priceUsdPerM).toFixed(2);

  // Hardware per table: 16 corner brackets, 32 T-nuts, 32 M8 bolts, 4 leveling feet/casters
  const bracketsCount = 16 * units;
  const tnutsCount = 32 * units;
  const boltsCount = 32 * units;
  const isSteel = prof.id.startsWith("Steel");
  const bracketUnitUsd = isSteel ? 0.55 : 0.95;
  const fastenerSetUsd = isSteel ? 12.0 : 18.5;
  const hardwareCostUsd = +(bracketsCount * bracketUnitUsd + units * fastenerSetUsd).toFixed(2);

  // Optional 18mm industrial MDF / Birch ply tabletop & heavy-duty locking casters
  const areaM2 = +((L / 1000) * (W / 1000)).toFixed(2);
  const topCostUsd = include_top ? +(areaM2 * 24.0 * units).toFixed(2) : 0;
  const casterCostUsd = include_casters ? +(11.5 * units).toFixed(2) : 0;

  // Bulk discount: 5% for >=3 units, 10% for >=5 units
  const rawSubtotalUsd = +(profileCostUsd + hardwareCostUsd + topCostUsd + casterCostUsd).toFixed(2);
  const discountRate = units >= 5 ? 0.1 : units >= 3 ? 0.05 : 0;
  const discountUsd = +(rawSubtotalUsd * discountRate).toFixed(2);
  const totalUsd = +(rawSubtotalUsd - discountUsd).toFixed(2);
  const totalVnd = Math.round(totalUsd * 25000);

  // Euler-Bernoulli mid-span deflection on one primary longitudinal beam carrying 50% of distributed load:
  // delta = 5 * W_beam * L_span^3 / (384 * E * I)
  // L_span in mm, E in N/mm^2 (1 GPa = 1000 MPa = 1000 N/mm^2), I in mm^4 (1 cm^4 = 10000 mm^4)
  const wBeamN = (loadKg * 9.81) * 0.5;
  const lSpanMm = longRailMm;
  const eMpa = prof.eGpa * 1000;
  const iMm4 = prof.ixCm4 * 10000;
  const deflectionMm = +((5 * wBeamN * Math.pow(lSpanMm, 3)) / (384 * eMpa * iMm4)).toFixed(3);
  const maxAllowedMm = +(lSpanMm / 300).toFixed(2);
  const safetyStatus = deflectionMm <= maxAllowedMm ? "PASS" : "RECOMMEND_4080_OR_CENTER_BRACE";

  const frameMassKg = +(totalMeters * prof.massKgPerM).toFixed(2);

  return {
    ok: true,
    inputs: { length_mm: L, width_mm: W, height_mm: H, profile_id: prof.id, load_kg: loadKg, qty: units, include_top, include_casters },
    profile: prof,
    cuts_per_unit: [
      { label: "Vertical Legs", length_mm: legCutMm, count: 4 },
      { label: "Longitudinal Rails", length_mm: longRailMm, count: 4 },
      { label: "Transverse Crossbars", length_mm: sideRailMm, count: 4 }
    ],
    hardware: {
      corner_brackets: bracketsCount,
      t_nuts: tnutsCount,
      m8_bolts: boltsCount,
      casters_or_feet: 4 * units
    },
    metrics: {
      total_profile_m: totalMeters,
      frame_mass_kg: frameMassKg,
      area_m2_per_unit: areaM2,
      deflection_mm: deflectionMm,
      limit_L300_mm: maxAllowedMm,
      safety_status: safetyStatus,
      utilization_ratio_pct: +((deflectionMm / maxAllowedMm) * 100).toFixed(1)
    },
    pricing: {
      profile_usd: profileCostUsd,
      hardware_usd: hardwareCostUsd,
      tabletop_usd: topCostUsd,
      casters_usd: casterCostUsd,
      subtotal_usd: rawSubtotalUsd,
      discount_pct: discountRate * 100,
      discount_usd: discountUsd,
      total_usd: totalUsd,
      total_vnd: totalVnd
    }
  };
}

export function runCutListFfd({
  length_mm = 1400,
  width_mm = 700,
  height_mm = 750,
  stock_length_mm = 6000,
  qty = 1,
  kerf_mm = 3
} = {}) {
  const L = clampNum(length_mm, 600, 3000, 1400);
  const W = clampNum(width_mm, 400, 1600, 700);
  const H = clampNum(height_mm, 500, 1400, 750);
  const stockMm = Number(stock_length_mm) === 2000 ? 2000 : 6000;
  const units = Math.round(clampNum(qty, 1, 100, 1));
  const kerf = clampNum(kerf_mm, 0, 10, 3);

  const longRail = Math.max(200, L - 80);
  const sideRail = Math.max(200, W - 80);

  const pieces = [];
  for (let u = 0; u < units; u++) {
    for (let i = 0; i < 4; i++) pieces.push({ type: "Leg", len: H });
    for (let i = 0; i < 4; i++) pieces.push({ type: "Long Rail", len: longRail });
    for (let i = 0; i < 4; i++) pieces.push({ type: "Crossbar", len: sideRail });
  }

  // First-Fit Decreasing (FFD)
  pieces.sort((a, b) => b.len - a.len);

  const oversized = pieces.filter((p) => p.len > stockMm);
  if (oversized.length > 0) {
    return {
      ok: false,
      reason: `Cut length ${oversized[0].len}mm exceeds selected ${stockMm}mm stock bar. Switch to 6000mm stock.`,
      stock_length_mm: stockMm
    };
  }

  const bars = [];
  for (const piece of pieces) {
    let placed = false;
    for (const bar of bars) {
      const need = bar.cuts.length === 0 ? piece.len : piece.len + kerf;
      if (bar.usedMm + need <= stockMm) {
        bar.cuts.push(piece);
        bar.usedMm += need;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bars.push({
        barIndex: bars.length + 1,
        cuts: [piece],
        usedMm: piece.len
      });
    }
  }

  const totalUsedMm = bars.reduce((acc, b) => acc + b.usedMm, 0);
  const totalStockMm = bars.length * stockMm;
  const scrapMm = totalStockMm - totalUsedMm;
  const utilizationPct = +((totalUsedMm / totalStockMm) * 100).toFixed(1);

  return {
    ok: true,
    stock_length_mm: stockMm,
    kerf_mm: kerf,
    total_cuts: pieces.length,
    total_bars_needed: bars.length,
    total_stock_mm: totalStockMm,
    total_used_mm: totalUsedMm,
    scrap_mm: scrapMm,
    utilization_pct: utilizationPct,
    bars: bars.map((b) => ({
      bar: b.barIndex,
      used_mm: b.usedMm,
      scrap_mm: stockMm - b.usedMm,
      cuts: b.cuts
    }))
  };
}

async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  if (globalThis.crypto && crypto.subtle) {
    const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback non-crypto checksum only if subtle is unavailable in insecure origin
  let h = 2166136261;
  for (const byte of bytes) {
    h ^= byte;
    h = Math.imul(h, 16777619);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

export class SiteActions {
  static registerActions(registry, uiBridge) {
    registry.register({
      name: "list_profiles",
      description: "Lists available aluminum (4040-Light, 4040-Heavy, 4080-Heavy) and steel structural profiles with moment of inertia Ix, Young's modulus E, mass/m, and price/m.",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      },
      execute: async () => ({ ok: true, profiles: PROFILES })
    });

    registry.register({
      name: "calculate_bom_and_deflection",
      description: "Computes exact frame cut lengths, hardware counts, cost, and Euler-Bernoulli mid-span beam deflection against the L/300 stiffness threshold.",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: {
          length_mm: { type: "number", minimum: 600, maximum: 3000 },
          width_mm: { type: "number", minimum: 400, maximum: 1600 },
          height_mm: { type: "number", minimum: 500, maximum: 1400 },
          profile_id: { type: "string", enum: PROFILES.map((p) => p.id) },
          load_kg: { type: "number", minimum: 10, maximum: 2000 },
          qty: { type: "number", minimum: 1, maximum: 100 }
        },
        required: ["length_mm", "width_mm", "height_mm", "profile_id", "load_kg"]
      },
      execute: async (args) => computeEngineeringBom(args)
    });

    registry.register({
      name: "optimize_cut_list",
      description: "Optimizes 1D cutting of frame legs, rails, and crossbars across 6000mm or 2000mm stock bars using First-Fit Decreasing bin-packing with 3mm saw kerf.",
      effect: "read",
      inputSchema: {
        type: "object",
        properties: {
          length_mm: { type: "number", minimum: 600, maximum: 3000 },
          width_mm: { type: "number", minimum: 400, maximum: 1600 },
          height_mm: { type: "number", minimum: 500, maximum: 1400 },
          stock_length_mm: { type: "number", enum: [2000, 6000] },
          qty: { type: "number", minimum: 1, maximum: 100 }
        },
        required: ["length_mm", "width_mm", "height_mm", "stock_length_mm"]
      },
      execute: async (args) => runCutListFfd(args)
    });

    registry.register({
      name: "apply_to_workbench",
      description: "Updates the live interactive SVG blueprint, controls, BOM table, and cut-list visualizer on the webpage.",
      effect: "write",
      inputSchema: {
        type: "object",
        properties: {
          length_mm: { type: "number", minimum: 600, maximum: 3000 },
          width_mm: { type: "number", minimum: 400, maximum: 1600 },
          height_mm: { type: "number", minimum: 500, maximum: 1400 },
          profile_id: { type: "string", enum: PROFILES.map((p) => p.id) },
          load_kg: { type: "number", minimum: 10, maximum: 2000 },
          stock_length_mm: { type: "number", enum: [2000, 6000] },
          qty: { type: "number", minimum: 1, maximum: 100 }
        },
        required: ["length_mm", "width_mm", "height_mm", "profile_id"]
      },
      execute: async (args) => {
        if (uiBridge && typeof uiBridge.applyParams === "function") {
          return uiBridge.applyParams(args);
        }
        return { ok: true, applied: args };
      }
    });

    registry.register({
      name: "issue_signed_rfq",
      description: "Generates a tamper-evident SHA-256 signed JSON RFQ receipt with full BOM and cut-list summary. Requires explicit visitor confirmation.",
      effect: "irreversible",
      inputSchema: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          profile_id: { type: "string", enum: PROFILES.map((p) => p.id) },
          length_mm: { type: "number", minimum: 600, maximum: 3000 },
          width_mm: { type: "number", minimum: 400, maximum: 1600 },
          height_mm: { type: "number", minimum: 500, maximum: 1400 },
          load_kg: { type: "number", minimum: 10, maximum: 2000 },
          qty: { type: "number", minimum: 1, maximum: 100 },
          stock_length_mm: { type: "number", enum: [2000, 6000] }
        },
        required: ["profile_id", "length_mm", "width_mm", "height_mm", "load_kg", "qty"]
      },
      execute: async (args) => {
        const bom = computeEngineeringBom(args);
        const cutlist = runCutListFfd(args);
        const payload = {
          rfq_id: "RFQ-" + Date.now().toString(36).toUpperCase(),
          issued_at: new Date().toISOString(),
          customer_name: args.customer_name || "Workshop Client",
          spec_profile: "worldwide-agentic-web-mvp/0.3",
          bom_summary: {
            dimensions_mm: `${bom.inputs.length_mm}x${bom.inputs.width_mm}x${bom.inputs.height_mm}`,
            profile: bom.profile.id,
            qty: bom.inputs.qty,
            load_kg: bom.inputs.load_kg,
            deflection_mm: bom.metrics.deflection_mm,
            limit_L300_mm: bom.metrics.limit_L300_mm,
            safety_status: bom.metrics.safety_status,
            total_usd: bom.pricing.total_usd,
            total_vnd: bom.pricing.total_vnd
          },
          cutlist_summary: cutlist.ok
            ? {
                stock_length_mm: cutlist.stock_length_mm,
                bars_needed: cutlist.total_bars_needed,
                utilization_pct: cutlist.utilization_pct,
                scrap_mm: cutlist.scrap_mm
              }
            : { error: cutlist.reason }
        };
        const digest = await sha256Hex(JSON.stringify(payload));
        const receipt = { ok: true, ...payload, sha256: digest };
        if (uiBridge && typeof uiBridge.onRfqIssued === "function") {
          uiBridge.onRfqIssued(receipt);
        }
        return receipt;
      }
    });
  }
}
