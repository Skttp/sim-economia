import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

/* =========================================================================
   MODELO ECONÓMICO
   ========================================================================= */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const PRODUCTS = [
  { id: "pan",   name: "Pan",            emoji: "🍞", base: 1.2,   stick: 0.35, vol: 0.6, ess: true,  basketQty: 30, cat: "food",     imp: 0.05 },
  { id: "leche", name: "Leche (L)",      emoji: "🥛", base: 1.5,   stick: 0.35, vol: 0.6, ess: true,  basketQty: 20, cat: "food",     imp: 0.05 },
  { id: "huevo", name: "Huevos (doc)",   emoji: "🥚", base: 3.0,   stick: 0.40, vol: 0.9, ess: true,  basketQty: 4,  cat: "food",     imp: 0.05 },
  { id: "arroz", name: "Arroz (kg)",     emoji: "🍚", base: 2.0,   stick: 0.35, vol: 0.5, ess: true,  basketQty: 8,  cat: "food",     imp: 0.10 },
  { id: "carne", name: "Carne (kg)",     emoji: "🥩", base: 9.0,   stick: 0.40, vol: 1.0, ess: true,  basketQty: 6,  cat: "food",     imp: 0.05 },
  { id: "nafta", name: "Nafta (L)",      emoji: "⛽", base: 1.8,   stick: 0.62, vol: 1.6, ess: true,  basketQty: 40, cat: "energy",   imp: 0.50 },
  { id: "luz",   name: "Electricidad",   emoji: "💡", base: 45,    stick: 0.45, vol: 0.8, ess: true,  basketQty: 1,  cat: "energy",   imp: 0.25 },
  { id: "renta", name: "Alquiler (mes)", emoji: "🏠", base: 600,   stick: 0.07, vol: 0.3, ess: true,  basketQty: 1,  cat: "housing",  imp: 0.00 },
  { id: "cafe",  name: "Café",           emoji: "☕", base: 4.5,   stick: 0.25, vol: 0.7, ess: false, basketQty: 0,  cat: "import",   imp: 0.40 },
  { id: "cerve", name: "Cerveza",        emoji: "🍺", base: 2.5,   stick: 0.35, vol: 0.7, ess: false, basketQty: 0,  cat: "food",     imp: 0.10 },
  { id: "jean",  name: "Jean",           emoji: "👖", base: 40,    stick: 0.30, vol: 0.8, ess: false, basketQty: 0,  cat: "import",   imp: 0.45 },
  { id: "cel",   name: "Smartphone",     emoji: "📱", base: 800,   stick: 0.30, vol: 1.3, ess: false, basketQty: 0,  cat: "import",   imp: 0.90 },
  { id: "cine",  name: "Entrada cine",   emoji: "🎬", base: 11,    stick: 0.20, vol: 0.6, ess: false, basketQty: 0,  cat: "service",  imp: 0.05 },
  { id: "auto",  name: "Auto",           emoji: "🚗", base: 22000, stick: 0.22, vol: 1.1, ess: false, basketQty: 0,  cat: "durable",  imp: 0.60 },
];

// shocks exógenos: eventos reales que sacuden la economía
const SHOCKS = {
  oil:     { name: "Shock petrolero",      emoji: "🛢️", color: "#ff8a3d", min: 2, max: 5, desc: "Se dispara el precio del crudo. Energía y transporte por las nubes.",  costPush: 0.004, potG: -0.0004, conf: -0.4, cats: ["energy"], catMult: 0.32 },
  drought: { name: "Sequía severa",        emoji: "🌵", color: "#e0a83d", min: 3, max: 7, desc: "La cosecha se pierde. Los alimentos escasean y se encarecen.",         costPush: 0.0035, potG: -0.0003, conf: -0.5, cats: ["food"], catMult: 0.28 },
  global:  { name: "Crisis global",        emoji: "🌐", color: "#6aa0ef", min: 3, max: 8, desc: "Recesión mundial: caen exportaciones y demanda externa.",             costPush: -0.001, potG: -0.0006, conf: -0.7, demandMult: 0.94, fxPush: 0.004, resDelta: -0.04 },
  panic:   { name: "Pánico financiero",    emoji: "💥", color: "#ff4d4d", min: 1, max: 4, desc: "Corrida bancaria y fuga de capitales. La moneda se desploma.",        costPush: 0.001, potG: -0.0008, conf: -1.4, fxPush: 0.020, resDelta: -0.10, risk: 800 },
  pandemic:{ name: "Pandemia",             emoji: "🦠", color: "#b07de0", min: 4, max: 10, desc: "Cuarentenas y cadenas rotas: cae la producción y suben costos.",      costPush: 0.0025, potG: -0.0012, conf: -1.0, demandMult: 0.96 },
  tech:    { name: "Boom tecnológico",     emoji: "🚀", color: "#4dd68a", min: 4, max: 9, desc: "Salto de productividad: crece la capacidad sin presionar precios.",   costPush: -0.0015, potG: 0.0014, conf: 0.8, cats: [], catMult: 0 },
  commodity:{ name: "Boom de commodities", emoji: "🌾", color: "#5fd3a8", min: 3, max: 7, desc: "Suben las exportaciones: entran divisas y se fortalece la moneda.",   costPush: 0, potG: 0.0005, conf: 0.6, fxPush: -0.008, resDelta: 0.12 },
};
const WORLD_INFL = 0.002;  // inflación mundial de referencia mensual (≈ 2,4% anual)
const WORLD_RATE = 2.5;    // tasa internacional de referencia

// población log-uniforme entre 50.000 y 1.400.000.000 (de pueblo a gran país)
function randomPopulation() {
  const lo = 50000, hi = 1.4e9;
  return Math.round(Math.exp(Math.random() * (Math.log(hi) - Math.log(lo)) + Math.log(lo)));
}

function initWorld() {
  const population = randomPopulation();
  const gdpPerCapita = 6000 + Math.random() * 49000;     // PIB per cápita anual (6k–55k)
  const m2Ratio = 0.4 + Math.random() * 0.5;             // relación dinero/PIB (0.4–0.9)
  const baseNominalGDP = population * gdpPerCapita;        // PIB nominal anual realista
  const baseM = baseNominalGDP * m2Ratio;                 // base monetaria realista
  const participation = 0.46 + Math.random() * 0.12;      // tasa de actividad (46%–58%)
  const laborForce = Math.round(population * participation);
  const natAnnual = -0.004 + Math.random() * 0.022;       // crecimiento vegetativo anual (-0,4% a +1,8%)
  const fxBase = Math.round((0.5 + Math.random() * 1200) * 100) / 100; // cotización inicial del dólar

  return {
    day: 0,
    // --- motor interno normalizado (mantiene la estabilidad del modelo) ---
    M: 1000,
    prevM: 1000,
    mTrend: 0,
    priceLevel: 100,
    potential: 100,
    gdp: 100,
    prevGdp: 100,
    unemployment: 5.0,
    rate: 3.0,
    confidence: 70,
    wage: 1800,
    pace: 0,
    infExpect: 0,        // expectativas de inflación (inercia)
    prevWage: 1800,      // para la espiral precios-salarios
    velocity: 10,
    tradeBalance: 0,     // balanza comercial (superávit/déficit)
    phase: "EQUILIBRIO",
    prevPhase: "EQUILIBRIO",
    products: PRODUCTS.map((p) => ({ id: p.id, price: p.base, prev: p.base })),
    history: [{ day: 0, infl: 0, gdp: 100, unemp: 5, price: 100, pp: 200, fx: 100, blue: 100 }],
    news: [],
    flash: null,
    // --- sector externo ---
    fx: fxBase, fxBase, prevFx: fxBase,
    fxBlue: fxBase, prevFxBlue: fxBase,  // dólar paralelo (blue)
    reserves: 6.0,       // meses de importaciones
    risk: 450,           // riesgo país (puntos básicos)
    fxDefense: 0,        // días de intervención cambiaria activa
    cepo: false,         // controles de cambio
    // --- herramientas y mercado ---
    encaje: 10,          // encaje bancario / reservas obligatorias (%)
    tariff: 10,          // aranceles a las importaciones (%)
    priceControl: false, // control de precios
    shortage: 0,         // desabastecimiento (0–100)
    // --- social ---
    poverty: 24,         // % bajo la línea de pobreza
    gini: 38,            // desigualdad (0–100)
    unrest: 0,           // malestar social acumulado
    // --- shocks exógenos ---
    shock: null,         // { key, daysLeft, total }
    shockCooldown: 24,
    // --- escala realista (solo para mostrar cifras creíbles) ---
    population, gdpPerCapita, m2Ratio, baseNominalGDP, baseM, laborForce,
    participation, natRate: natAnnual / 12, netMigration: 0,   // demografía
    scaleMoney: baseM / 1000,            // M interno 1000 → base monetaria realista
    // --- informe mensual ---
    reports: [],
    monthStart: { day: 0, priceLevel: 100, gdp: 100, M: 1000, wage: 1800, fx: fxBase, pop: population },
    acc: { unempSum: 0, inflSum: 0, count: 0, phaseTally: {}, confSum: 0, povSum: 0 },
  };
}

const PHASES = {
  HIPERINFLACION: { label: "HIPERINFLACIÓN", color: "#ff4d4d", glow: "rgba(255,77,77,.35)", desc: "El dinero pierde valor por hora. La gente corre a gastar el sueldo apenas lo cobra." },
  ESTANFLACION:   { label: "ESTANFLACIÓN",   color: "#ff8a3d", glow: "rgba(255,138,61,.3)", desc: "Lo peor de dos mundos: los precios suben y la actividad cae al mismo tiempo." },
  SOBRECALENTAMIENTO: { label: "SOBRECALENTAMIENTO", color: "#ffb02e", glow: "rgba(255,176,46,.3)", desc: "La economía gira a tope, pero los precios empiezan a recalentarse peligrosamente." },
  INFLACION_ALTA: { label: "INFLACIÓN ALTA",  color: "#ffb02e", glow: "rgba(255,176,46,.28)", desc: "Los precios suben rápido y a la gente cada vez le cuesta más llegar a fin de mes." },
  AUGE:           { label: "AUGE / BOOM",     color: "#4dd68a", glow: "rgba(77,211,138,.3)", desc: "Pleno empleo, salarios al alza y comercios desbordados. Tiempos de bonanza." },
  RECUPERACION:   { label: "RECUPERACIÓN",    color: "#5fd3a8", glow: "rgba(95,211,168,.25)", desc: "La rueda vuelve a girar: se contrata de nuevo y la confianza renace de a poco." },
  DEPRESION:      { label: "DEPRESIÓN",       color: "#5b8def", glow: "rgba(91,141,239,.3)", desc: "Fábricas paradas, despidos masivos y colas en las oficinas de empleo." },
  RECESION:       { label: "RECESIÓN",        color: "#6aa0ef", glow: "rgba(106,160,239,.28)", desc: "Se enfría la actividad: cierran negocios y la gente posterga sus compras." },
  DEFLACION:      { label: "DEFLACIÓN",       color: "#56c4d8", glow: "rgba(86,196,216,.28)", desc: "Los precios caen y nadie quiere comprar hoy lo que mañana será más barato." },
  EQUILIBRIO:     { label: "EQUILIBRIO",      color: "#cfc6a8", glow: "rgba(207,198,168,.2)", desc: "Precios estables y empleo en su nivel natural. La economía respira tranquila." },
};
// fix accidental cyrillic
PHASES.AUGE.label = "AUGE / BOOM";

const NEWS_POOL = {
  HIPERINFLACION: [
    "Los comercios remarcan precios dos veces al día.",
    "Las familias gastan el sueldo en el acto para que no se evapore.",
    "Reaparece el trueque en los barrios; nadie confía en el billete.",
    "Furor por el dólar y los bienes durables como refugio de valor.",
  ],
  ESTANFLACION: [
    "Suben los precios pero las ventas se desploman.",
    "Empresas congelan contrataciones y aun así remarcan.",
    "El malestar social crece: caro y sin laburo.",
  ],
  SOBRECALENTAMIENTO: [
    "Las fábricas trabajan a triple turno y no dan abasto.",
    "Faltan trabajadores: las empresas se los disputan.",
    "Economistas advierten que esto puede recalentar los precios.",
  ],
  INFLACION_ALTA: [
    "Los supermercados llenan changos antes del próximo aumento.",
    "Los sindicatos piden reabrir paritarias por la suba de precios.",
    "El sueldo rinde cada vez menos en la góndola.",
  ],
  AUGE: [
    "Récord de empleo: casi todos los que buscan trabajo lo consiguen.",
    "Los shoppings reportan ventas históricas este fin de semana.",
    "Optimismo en las calles: aumentan los planes de viaje y consumo.",
  ],
  RECUPERACION: [
    "Las pymes vuelven a tomar empleados de a poco.",
    "Repuntan las ventas tras meses difíciles.",
    "Vuelve la confianza: las familias retoman compras postergadas.",
  ],
  DEPRESION: [
    "Largas colas en las oficinas de empleo.",
    "Cierran comercios históricos del centro.",
    "Comedores comunitarios desbordados por la crisis.",
  ],
  RECESION: [
    "Caen las ventas y los negocios ofrecen liquidaciones.",
    "Las familias recortan gastos y posponen compras grandes.",
    "Crece la preocupación por los despidos en la industria.",
  ],
  DEFLACION: [
    "Los precios bajan pero la gente espera para comprar más barato.",
    "Las empresas frenan inversiones ante la caída de la demanda.",
    "Paradoja: todo más barato, pero nadie gasta.",
  ],
  EQUILIBRIO: [
    "Jornada tranquila en los mercados; precios sin cambios.",
    "El consumo se mantiene firme y estable.",
    "Pleno funcionamiento: ni euforia ni miedo en las calles.",
  ],
};

function classifyPhase(pace, growth, unemp, prevPhase) {
  if (pace > 0.10) return "HIPERINFLACION";          // >10%/mes
  if (pace > 0.035 && growth < -0.0005) return "ESTANFLACION";
  if (pace > 0.035 && growth > 0.0035) return "SOBRECALENTAMIENTO";
  if (pace > 0.03) return "INFLACION_ALTA";          // >3%/mes (~43%/año)
  if (growth < -0.0035 && unemp > 9) return "DEPRESION";
  if (growth < -0.0012) return "RECESION";
  if (pace < -0.008) return "DEFLACION";
  if (growth > 0.004 && unemp < 5) return "AUGE";
  if (growth > 0.0012 && (prevPhase === "RECESION" || prevPhase === "DEPRESION" || prevPhase === "RECUPERACION"))
    return "RECUPERACION";
  return "EQUILIBRIO";
}

function step(w) {
  const noise = () => (Math.random() - 0.5);

  // ---- shocks exógenos (eventos del mundo real) ----
  let shock = w.shock;
  let shockCooldown = w.shockCooldown;
  let shockStarted = null;
  if (shock) {
    shock = { ...shock, daysLeft: shock.daysLeft - 1 };
    if (shock.daysLeft <= 0) { shock = null; shockCooldown = 18 + Math.floor(Math.random() * 42); }
  } else {
    shockCooldown = Math.max(0, shockCooldown - 1);
    if (shockCooldown === 0 && Math.random() < 0.025) {
      const keys = Object.keys(SHOCKS);
      const key = keys[Math.floor(Math.random() * keys.length)];
      const cfg = SHOCKS[key];
      const total = Math.round(cfg.min + Math.random() * (cfg.max - cfg.min));
      shock = { key, daysLeft: total, total };
      shockStarted = cfg;
    }
  }
  const sc = shock ? SHOCKS[shock.key] : null;
  const sActive = !!sc;

  // ---- demografía: la población crece o cae por vegetativo + migración ----
  // en crisis (alto desempleo/pobreza, baja confianza) la gente emigra; en las buenas, llega
  const migAnnual = clamp(
    (w.confidence - 55) * 0.0005 - (w.unemployment - 7) * 0.0007 - Math.max(0, w.poverty - 35) * 0.0004,
    -0.05, 0.03
  );
  const popGrowthM = w.natRate + migAnnual / 12;            // crecimiento poblacional mensual
  const population = Math.max(1000, Math.round(w.population * (1 + popGrowthM)));
  const laborForce = Math.round(population * w.participation);
  const netMigration = migAnnual * 100;                    // % anual (para mostrar)

  // velocidad del dinero según tasa, confianza y encaje bancario
  const encajeFactor = clamp(1 - (w.encaje - 10) * 0.012, 0.45, 1.25);
  const velocity = clamp(
    10 * (1 + (3 - w.rate) * 0.04) * Math.pow(clamp(w.confidence / 70, 0.3, 1.5), 0.5) * encajeFactor,
    2, 20
  );

  const demandMult = sActive && sc.demandMult ? sc.demandMult : 1;
  const AD = w.M * velocity;                       // demanda nominal
  const realDemand = (AD / w.priceLevel) * demandMult;

  // potencial: productividad + más trabajadores (población) − riesgo país − aranceles + shock
  const potGrowth = 0.0002 + popGrowthM * 0.85 - (w.risk - 450) * 2e-7 - Math.max(0, w.tariff - 15) * 4e-6 + (sActive ? sc.potG : 0);
  const potential = Math.max(10, w.potential * (1 + potGrowth));
  const gap = (realDemand - potential) / potential;

  // crecimiento monetario suavizado
  const mGrowth = (w.M - w.prevM) / Math.max(w.prevM, 1);
  const mTrend = 0.8 * w.mTrend + 0.2 * mGrowth;

  // pasaje a precios de la devaluación reciente
  const fxGrowth = (w.fx - w.prevFx) / Math.max(w.prevFx, 0.0001);
  const fxPush = clamp(fxGrowth * 0.16, -0.01, 0.05);

  // expectativas de inflación (inercia: corazón de la persistencia inflacionaria)
  const infExpect = clamp(0.88 * w.infExpect + 0.12 * w.pace, -0.02, 0.4);

  // inflación del período (expectativas + brecha + dinero + dólar + salarios + shock)
  const costPush = sActive ? sc.costPush : 0;
  const wagePush = clamp((w.wage - w.prevWage) / Math.max(w.prevWage, 1) - w.pace, 0, 0.1) * 0.25;
  let pace = 0.46 * w.pace + 0.2 * infExpect + 0.34 * (gap * 0.09) + mTrend * 0.06 + fxPush + wagePush + costPush + noise() * 0.0008;
  pace = clamp(pace, -0.05, 0.45);
  const priceLevel = clamp(w.priceLevel * (1 + pace), 1, 1e14);

  // producto real: la oferta no puede superar mucho al potencial → exceso = inflación
  const gdpTarget = potential * (1 + Math.tanh(gap * 0.8) * 0.16);
  const gdp = w.gdp + (gdpTarget - w.gdp) * 0.22;
  const growth = (gdp - w.prevGdp) / Math.max(w.prevGdp, 1);

  // desempleo (ley de Okun + reversión al natural + protección por aranceles)
  let unemployment = w.unemployment - 9 * (growth - 0.0002);
  unemployment += (5 - unemployment) * 0.02;
  unemployment += -(clamp(w.tariff, 0, 60) - 10) * 0.006;
  unemployment = clamp(unemployment, 1.5, 45);

  // confianza
  const infPenalty = -Math.min(Math.abs(pace) * 220, 9);
  const unempPenalty = -(unemployment - 5) * 0.35;
  const growthBonus = growth * 320;
  const shockConf = sActive ? sc.conf : 0;
  const distortConf = -(w.cepo ? 0.3 : 0) - (w.priceControl ? 0.25 : 0) - w.shortage * 0.012;
  let confidence = w.confidence + (infPenalty + unempPenalty + growthBonus) * 0.5 + (70 - w.confidence) * 0.012 + shockConf + distortConf;
  confidence = clamp(confidence, 4, 100);

  // salarios (rezagados; ajustan por inflación y expectativas)
  let wage = w.wage * (1 + pace * 0.4 + infExpect * 0.2 + Math.max(0, 5 - unemployment) * 0.0018);

  // ---- sector externo: dólar oficial, blue, cepo, reservas, riesgo país ----
  let fxDefense = Math.max(0, w.fxDefense - 1);
  const inflGap = pace - WORLD_INFL;                 // diferencial de inflación (PPP)
  const rateGap = (w.rate - WORLD_RATE) * 0.0008;    // tasa alta sostiene la moneda
  const confDrag = (55 - confidence) * 0.0004;       // confianza baja → fuga de capitales
  const shockFx = sActive && sc.fxPush ? sc.fxPush : 0;
  const basePressure = inflGap * 0.7 + mTrend * 0.25 + confDrag - rateGap + shockFx + noise() * 0.002;

  // dólar oficial: el cepo lo reprime; la intervención lo baja
  let offP = w.cepo ? basePressure * 0.2 : basePressure;
  if (fxDefense > 0) offP -= 0.012;
  const fx = clamp(w.fx * (1 + clamp(offP, -0.05, 0.4)), 0.01, w.fxBase * 1e9);

  // dólar blue (paralelo): absorbe la presión reprimida y la desconfianza
  let blueP;
  if (w.cepo) {
    blueP = basePressure * 1.15 + 0.004 + Math.max(0, confDrag) * 0.6;
  } else {
    blueP = ((fx - w.fxBlue) / Math.max(w.fxBlue, 0.01)) * 0.35 + basePressure; // converge al oficial
  }
  const fxBlue = clamp(w.fxBlue * (1 + clamp(blueP, -0.06, 0.5)), fx * 0.97, w.fxBase * 1e10);
  const brecha = (fxBlue / Math.max(fx, 0.01) - 1) * 100;

  // tipo de cambio efectivo para importaciones (con cepo, importar cuesta como el blue)
  const fxEff = w.cepo ? 0.45 * fx + 0.55 * fxBlue : fx;

  // balanza comercial: dólar real barato → más exportaciones; demanda alta y peso fuerte (o sin aranceles) → más importaciones
  const fxReal = (fx / w.fxBase) / (priceLevel / 100);
  const exportsIdx = clamp(fxReal, 0.4, 3) * (sActive && sc.demandMult ? sc.demandMult : 1);
  const importsIdx = (realDemand / potential) * (1 / clamp(fxReal, 0.4, 3)) * (1 - clamp(w.tariff, 0, 80) / 140);
  const tradeBalance = exportsIdx - importsIdx;   // ≈ 0 en equilibrio

  let reserves = w.reserves + tradeBalance * 0.05 + (sActive && sc.resDelta ? sc.resDelta : 0)
    + (confidence > 60 ? 0.005 : -0.01) - (fxDefense > 0 ? 0.05 : 0) + (w.cepo ? 0.004 : 0);
  reserves = clamp(reserves, 0, 24);
  if (reserves <= 0.05) fxDefense = 0;               // sin reservas no se puede defender

  const riskTarget = clamp(
    300 + Math.max(0, pace - 0.004) * 6000 + Math.max(0, 5 - reserves) * 180
      + (70 - confidence) * 12 + (sActive && sc.risk ? sc.risk : 0) + (w.cepo ? 250 : 0) + brecha * 4,
    80, 6000
  );
  const risk = w.risk + (riskTarget - w.risk) * 0.1;

  // desigualdad
  const giniTarget = clamp(36 + Math.max(0, pace - 0.004) * 320 + (unemployment - 5) * 0.4, 28, 66);
  const gini = w.gini + (giniTarget - w.gini) * 0.05;

  // desabastecimiento por control de precios
  let shortage = w.shortage + (w.priceControl ? Math.max(0, pace) * 1400 + 0.6 : -2.5);
  shortage = clamp(shortage, 0, 100);

  // precios micro: índice general × pasaje del dólar (efectivo) × arancel × shock sectorial
  const fxRatio = fxEff / w.fxBase;
  const stickMult = w.priceControl ? 0.2 : 1;        // control de precios congela la góndola
  const products = w.products.map((p) => {
    const meta = PRODUCTS.find((x) => x.id === p.id);
    const sector = sActive && sc.cats && sc.cats.includes(meta.cat) ? 1 + sc.catMult : 1;
    const tariffFactor = 1 + (w.tariff / 100) * meta.imp;   // el arancel encarece la parte importada
    const target = meta.base * (priceLevel / 100) * Math.pow(Math.max(fxRatio, 0.01), meta.imp) * tariffFactor * sector;
    const idio = 1 + noise() * 0.012 * meta.vol;
    const next = p.price + (target * idio - p.price) * meta.stick * stickMult;
    return { id: p.id, price: Math.max(0.01, next), prev: p.price };
  });

  // canasta básica + poder adquisitivo
  const basket = products.reduce((acc, p) => {
    const meta = PRODUCTS.find((x) => x.id === p.id);
    return acc + (meta.ess ? p.price * meta.basketQty : 0);
  }, 0);
  const pp = (wage / basket) * 100; // poder adquisitivo (índice)

  // pobreza y malestar social
  const povTarget = clamp(24 - (pp - 100) * 0.14 + (unemployment - 5) * 1.4 + Math.max(0, pace - 0.006) * 240, 2, 88);
  const poverty = w.poverty + (povTarget - w.poverty) * 0.08;
  const unrest = clamp(
    w.unrest + (poverty > 40 ? 0.6 : -0.45) + (unemployment > 13 ? 0.5 : 0) + (pace > 0.02 ? 0.6 : 0) + (shortage > 50 ? 0.5 : 0),
    0, 100
  );

  const day = w.day + 1;
  const phase = classifyPhase(pace, growth, unemployment, w.phase);

  // noticias (shocks, protestas, fase)
  let news = w.news;
  if (shockStarted) {
    news = [{ day, msg: `${shockStarted.emoji} ${shockStarted.name}: ${shockStarted.desc}`, phase, alert: true }, ...w.news].slice(0, 8);
  } else if (unrest > 55 && day % 4 === 0) {
    news = [{ day, msg: "✊ Estallan protestas y reclamos por el malestar social.", phase, alert: true }, ...w.news].slice(0, 8);
  } else if (phase !== w.phase || day % 3 === 0) {
    const pool = NEWS_POOL[phase];
    const msg = pool[Math.floor(Math.random() * pool.length)];
    news = [{ day, msg, phase }, ...w.news].slice(0, 8);
  }

  const history = [
    ...w.history,
    { day, infl: +(pace * 100).toFixed(2), gdp: +gdp.toFixed(1), unemp: +unemployment.toFixed(1), price: +priceLevel.toFixed(1), pp: +pp.toFixed(0), fx: +((fx / w.fxBase) * 100).toFixed(1), blue: +((fxBlue / w.fxBase) * 100).toFixed(1) },
  ].slice(-90);

  // acumulación del mes en curso
  let acc = {
    unempSum: w.acc.unempSum + unemployment,
    inflSum: w.acc.inflSum + pace * 100,
    confSum: w.acc.confSum + confidence,
    povSum: w.acc.povSum + poverty,
    count: w.acc.count + 1,
    phaseTally: { ...w.acc.phaseTally, [phase]: (w.acc.phaseTally[phase] || 0) + 1 },
  };

  // cierre de año (cada 12 meses) → informe con todos los datos
  let reports = w.reports;
  let monthStart = w.monthStart;
  if (day % 12 === 0) {
    const dom = Object.entries(acc.phaseTally).sort((a, b) => b[1] - a[1])[0]?.[0] || phase;
    const monthInfl = (priceLevel / monthStart.priceLevel - 1) * 100;  // inflación anual
    const monthGdp = (gdp / monthStart.gdp - 1) * 100;                 // crecimiento anual
    const monthM = (w.M / monthStart.M - 1) * 100;
    const monthWage = (wage / monthStart.wage - 1) * 100;
    const monthFx = (fx / monthStart.fx - 1) * 100;
    const employed = Math.round(laborForce * (1 - unemployment / 100));
    const unemployed = laborForce - employed;
    const nominalGDP = (gdp / 100) * (priceLevel / 100) * w.baseNominalGDP;
    const realWageChg = monthWage - monthInfl;
    const popChange = (population / monthStart.pop - 1) * 100;   // variación anual de población
    const gdpPerCap = nominalGDP / Math.max(population, 1);
    const verdict =
      monthInfl > 150 ? "🔴 Inflación fuera de control: la moneda se desploma." :
      monthFx > 80 ? "🔴 Corrida cambiaria: el dólar se disparó este año." :
      monthInfl > 30 ? "🟠 Inflación elevada: el bolsillo de la gente sufre." :
      monthGdp < -6 ? "🔵 Recesión profunda: caída de la actividad y empleos perdidos." :
      monthGdp < -1.5 ? "🔵 Año recesivo: la economía se contrajo." :
      monthInfl >= -2 && monthInfl <= 10 && monthGdp > 1.5 ? "🟢 Año saludable: creció con precios bajo control." :
      "🟡 Año mixto: sin grandes sobresaltos.";

    const report = {
      year: day / 12,
      from: monthStart.day + 1, to: day,
      monthInfl, monthGdp, monthM, monthWage, monthFx, realWageChg,
      avgUnemp: acc.unempSum / acc.count,
      avgConf: acc.confSum / acc.count,
      avgPov: acc.povSum / acc.count,
      rate: w.rate, fxRate: fx, fxBlue, brecha, reserves, risk, gini, shortage, encaje: w.encaje, tariff: w.tariff, tradeBalance, cepo: w.cepo, priceControl: w.priceControl,
      priceLevel, pp, nominalGDP,
      baseMoney: w.M * w.scaleMoney,
      employed, unemployed,
      population, popChange, netMigration, gdpPerCap,
      domPhase: dom,
      verdict,
    };
    reports = [report, ...w.reports].slice(0, 30);
    monthStart = { day, priceLevel, gdp, M: w.M, wage, fx, pop: population };
    acc = { unempSum: 0, inflSum: 0, confSum: 0, povSum: 0, count: 0, phaseTally: {} };
  }

  return {
    ...w, day, prevM: w.M, mTrend, priceLevel, potential, gdp, prevGdp: w.gdp,
    unemployment, confidence, wage, prevWage: w.wage, pace, infExpect, velocity, products, phase, prevPhase: w.phase,
    fx, prevFx: w.fx, fxBlue, prevFxBlue: w.fxBlue, reserves, risk, fxDefense, poverty, gini, unrest, shortage, tradeBalance,
    population, laborForce, netMigration,
    shock, shockCooldown, history, news, flash: null, acc, reports, monthStart,
  };
}

/* =========================================================================
   COMPONENTE
   ========================================================================= */

const SPEEDS = [
  { label: "5s/mes", ms: 5000 },
  { label: "2.5s", ms: 2500 },
  { label: "1s", ms: 1000 },
];

export default function App() {
  const [w, setW] = useState(initWorld);
  const [running, setRunning] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setW((prev) => step(prev)), SPEEDS[speedIdx].ms);
    return () => clearInterval(id);
  }, [running, speedIdx]);

  const doFlash = (kind) => {
    setFlash(kind);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 650);
  };

  const emit = (pct) => { setW((p) => ({ ...p, M: clamp(p.M * (1 + pct / 100), 1, 1e11) })); doFlash("emit"); };
  const contract = (pct) => { setW((p) => ({ ...p, M: clamp(p.M * (1 - clamp(pct, 0, 99) / 100), 1, 1e11) })); doFlash("contract"); };
  const setRate = (v) => setW((p) => ({ ...p, rate: clamp(+(+v).toFixed(2), 0, 1000) }));
  const setEncaje = (v) => setW((p) => ({ ...p, encaje: clamp(+(+v).toFixed(2), 0, 100) }));
  const setTariff = (v) => setW((p) => ({ ...p, tariff: clamp(+(+v).toFixed(2), 0, 400) }));
  const decreeWage = (pct) => { setW((p) => ({ ...p, wage: p.wage * (1 + pct / 100) })); doFlash("emit"); };
  const intervene = (pct) => {
    setW((p) => {
      if (p.reserves < 0.3) return p;
      const cost = Math.max(0.05, (pct / 100) * 9);
      const eff = p.reserves >= cost ? pct : pct * (p.reserves / cost);
      return { ...p, fx: p.fx * (1 - eff / 100), reserves: clamp(p.reserves - Math.min(cost, p.reserves), 0, 24), fxDefense: Math.round(8 + pct) };
    });
    doFlash("contract");
  };
  const toggleCepo = () => setW((p) => ({ ...p, cepo: !p.cepo }));
  const togglePC = () => setW((p) => ({ ...p, priceControl: !p.priceControl }));
  const reset = () => { setW(initWorld()); setRunning(false); };

  const phase = PHASES[w.phase];
  const inflPct = w.pace * 100;
  const growthPct = ((w.gdp - w.prevGdp) / Math.max(w.prevGdp, 1)) * 100;
  const basket = useMemo(() => w.products.reduce((a, p) => {
    const m = PRODUCTS.find((x) => x.id === p.id);
    return a + (m.ess ? p.price * m.basketQty : 0);
  }, 0), [w.products]);
  const pp = (w.wage / basket) * 100;
  const mGrowthPct = ((w.M - w.prevM) / Math.max(w.prevM, 1)) * 100;

  // cifras realistas derivadas
  const baseMoney = w.M * w.scaleMoney;
  const nominalGDP = (w.gdp / 100) * (w.priceLevel / 100) * w.baseNominalGDP;
  const employed = Math.round(w.laborForce * (1 - w.unemployment / 100));
  const unemployed = w.laborForce - employed;
  const gdpPerCap = nominalGDP / Math.max(w.population, 1);
  const popGrowthAnnual = w.natRate * 12 * 100 + w.netMigration;
  const fxChgPct = ((w.fx - w.prevFx) / Math.max(w.prevFx, 1e-6)) * 100;
  const brechaPct = (w.fxBlue / Math.max(w.fx, 0.01) - 1) * 100;
  // inflación anualizada (variación de precios de los últimos 12 meses)
  const annualInfl = useMemo(() => {
    const h = w.history;
    const past = h.length > 12 ? h[h.length - 13].price : h[0].price;
    return (w.priceLevel / Math.max(past, 0.01) - 1) * 100;
  }, [w.history, w.priceLevel]);
  const shock = w.shock ? SHOCKS[w.shock.key] : null;
  const mes = w.day === 0 ? 0 : ((w.day - 1) % 12) + 1;
  const year = w.day === 0 ? 1 : Math.floor((w.day - 1) / 12) + 1;
  const MESES = ["—", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const fmt = (n, d = 2) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtInt = (n) => Math.round(n).toLocaleString("es-AR");
  // dinero con escala en español
  const fmtMoney = (n) => {
    const a = Math.abs(n);
    if (a >= 1e12) return "$" + (n / 1e12).toFixed(2) + " bill.";
    if (a >= 1e9) return "$" + (n / 1e9).toFixed(2) + " mil M";
    if (a >= 1e6) return "$" + (n / 1e6).toFixed(2) + " M";
    if (a >= 1e3) return "$" + (n / 1e3).toFixed(1) + " mil";
    return "$" + n.toFixed(0);
  };
  const fmtPct = (n) => {
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(1) + "M%";
    if (a >= 1e4) return (n / 1e3).toFixed(0) + "k%";
    return fmt(n, a >= 100 ? 0 : 1) + "%";
  };
  const fmtFx = (n) => n >= 1000 ? fmtMoney(n).replace("$", "$") : "$" + fmt(n, 2);
  const fmtPop = (n) => {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + " mil M";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + " M";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + " mil";
    return fmtInt(n);
  };

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      {/* fondo */}
      <div style={S.grid} />
      <div style={{ ...S.glow, background: `radial-gradient(900px 400px at 50% -5%, ${phase.glow}, transparent 70%)` }} />
      {flash && <div style={{ ...S.flash, background: flash === "emit" ? "rgba(95,211,138,.10)" : "rgba(106,160,239,.10)" }} />}

      <div style={S.shell}>
        {/* ===== HEADER ===== */}
        <header style={S.header}>
          <div>
            <div style={S.kicker}>CONSOLA DE POLÍTICA MONETARIA</div>
            <h1 style={S.title}>Banco Central</h1>
          </div>
          <div style={S.headRight}>
            <div style={S.popBox}>
              <span style={S.dayLabel}>POBLACIÓN</span>
              <span style={S.popNum}>{fmtInt(w.population)}</span>
            </div>
            <div style={S.dayBox}>
              <span style={S.dayLabel}>{MESES[mes]} · MES {mes}</span>
              <span style={S.dayNum} key={w.day}>Año {year}</span>
            </div>
            <div style={S.transport}>
              <button style={{ ...S.ctrlBtn, ...(running ? S.ctrlOn : {}) }} onClick={() => { setRunning((r) => !r); setStarted(true); }}>
                {running ? "❚❚ Pausar" : "▶ Avanzar"}
              </button>
              <button style={S.ctrlBtn} onClick={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)}>⏱ {SPEEDS[speedIdx].label}</button>
              <button style={S.ctrlBtn} onClick={reset}>↺ Reiniciar</button>
            </div>
          </div>
        </header>

        {/* ===== FASE ===== */}
        <section style={{ ...S.phase, borderColor: phase.color, boxShadow: `0 0 40px -8px ${phase.glow}` }}>
          <div style={S.phaseTop}>
            <span style={{ ...S.phaseDot, background: phase.color, boxShadow: `0 0 12px ${phase.color}` }} />
            <span style={S.phaseLabel}>FASE ECONÓMICA</span>
          </div>
          <div style={{ ...S.phaseName, color: phase.color }}>{phase.label}</div>
          <div style={S.phaseDesc}>{phase.desc}</div>
        </section>

        {/* ===== SHOCK ACTIVO ===== */}
        {shock && (
          <section style={{ ...S.shockBanner, borderColor: shock.color, boxShadow: `0 0 26px -10px ${shock.color}` }}>
            <span style={S.shockEmoji}>{shock.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ ...S.shockName, color: shock.color }}>SHOCK: {shock.name}</div>
              <div style={S.shockDesc}>{shock.desc}</div>
            </div>
            <div style={S.shockDays}>{w.shock.daysLeft} {w.shock.daysLeft === 1 ? "mes" : "meses"} restantes</div>
          </section>
        )}

        {/* ===== MACRO ===== */}
        <section style={S.macroGrid}>
          <Stat label="Inflación mensual" value={`${inflPct >= 0 ? "+" : ""}${fmt(inflPct, 2)}%`}
            tone={inflPct > 3 ? "bad" : inflPct < -0.8 ? "info" : "ok"} sub={`anualizada ${fmtPct(annualInfl)}`} />
          <Stat label="PIB nominal" value={fmtMoney(nominalGDP)}
            tone={growthPct > 0.1 ? "good" : growthPct < -0.1 ? "bad" : "neutral"}
            sub={`${growthPct >= 0 ? "+" : ""}${fmt(growthPct, 2)}% actividad`} />
          <Stat label="Desempleo" value={`${fmt(w.unemployment, 1)}%`}
            tone={w.unemployment > 9 ? "bad" : w.unemployment < 4 ? "good" : "neutral"}
            sub={`${fmtPop(unemployed)} sin trabajo`} />
          <Stat label="Base monetaria" value={fmtMoney(baseMoney)}
            tone={mGrowthPct > 0.5 ? "info" : mGrowthPct < -0.5 ? "info" : "neutral"}
            sub={`${mGrowthPct >= 0 ? "+" : ""}${fmt(mGrowthPct, 1)}% vs mes ant.`} />
          <Stat label="Tasa de interés" value={`${fmt(w.rate, 2)}%`} tone="neutral" sub="costo del dinero" />
          <Stat label="Confianza social" value={`${fmt(w.confidence, 0)}`}
            tone={w.confidence > 70 ? "good" : w.confidence < 40 ? "bad" : "neutral"}
            sub={`${fmtPop(employed)} con empleo`} />
        </section>

        {/* ===== SECTOR EXTERNO + SOCIAL ===== */}
        <section style={S.macroGrid}>
          <Stat label="Dólar oficial" value={fmtFx(w.fx)}
            tone={fxChgPct > 0.5 ? "bad" : fxChgPct < -0.5 ? "good" : "neutral"}
            sub={`${fxChgPct >= 0 ? "+" : ""}${fmt(fxChgPct, 2)}% vs mes ant.`} />
          <Stat label="Dólar blue" value={fmtFx(w.fxBlue)}
            tone={brechaPct > 30 ? "bad" : brechaPct < 8 ? "good" : "neutral"}
            sub={`brecha ${fmt(brechaPct, 0)}%`} />
          <Stat label="Reservas" value={`${fmt(w.reserves, 1)}`}
            tone={w.reserves < 2 ? "bad" : w.reserves > 8 ? "good" : "neutral"} sub="meses de importaciones" />
          <Stat label="Riesgo país" value={`${fmtInt(w.risk)}`}
            tone={w.risk > 1500 ? "bad" : w.risk < 500 ? "good" : "neutral"} sub="puntos básicos" />
          <Stat label="Pobreza" value={`${fmt(w.poverty, 1)}%`}
            tone={w.poverty > 40 ? "bad" : w.poverty < 20 ? "good" : "neutral"}
            sub={`${fmtPop(Math.round(w.population * w.poverty / 100))} personas`} />
          <Stat label="Desabastecimiento" value={`${fmt(w.shortage, 0)}`}
            tone={w.shortage > 50 ? "bad" : w.shortage < 10 ? "good" : "neutral"} sub="góndolas vacías" />
        </section>

        {/* ===== INDICADORES SECUNDARIOS ===== */}
        <section style={S.macroGrid}>
          <Stat label="Encaje bancario" value={`${fmt(w.encaje, 0)}%`} tone="neutral" sub="reservas obligatorias" />
          <Stat label="PIB per cápita" value={fmtMoney(gdpPerCap)} tone="neutral" sub="riqueza por persona" />
          <Stat label="Población (var.)" value={`${popGrowthAnnual >= 0 ? "+" : ""}${fmt(popGrowthAnnual, 2)}%`}
            tone={popGrowthAnnual > 0.3 ? "good" : popGrowthAnnual < -0.5 ? "bad" : "neutral"}
            sub={`migración ${w.netMigration >= 0 ? "+" : ""}${fmt(w.netMigration, 1)}%/año`} />
          <Stat label="Aranceles" value={`${fmt(w.tariff, 0)}%`} tone="neutral" sub="a las importaciones" />
          <Stat label="Balanza comercial" value={`${w.tradeBalance >= 0 ? "+" : ""}${fmt(w.tradeBalance * 100, 0)}`}
            tone={w.tradeBalance > 0.03 ? "good" : w.tradeBalance < -0.03 ? "bad" : "neutral"}
            sub={w.tradeBalance >= 0 ? "superávit (entran divisas)" : "déficit (se van divisas)"} />
          <Stat label="Velocidad dinero" value={`${fmt(w.velocity, 1)}`} tone="neutral" sub="rotación del dinero" />
          <Stat label="Desigualdad (Gini)" value={`${fmt(w.gini, 0)}`}
            tone={w.gini > 50 ? "bad" : w.gini < 35 ? "good" : "neutral"} sub="0 = igual · 100 = total" />
          <Stat label="Malestar social" value={`${fmt(w.unrest, 0)}`}
            tone={w.unrest > 55 ? "bad" : w.unrest < 20 ? "good" : "neutral"} sub="tensión en las calles" />
          <Stat label="Cepo cambiario" value={w.cepo ? "ACTIVO" : "no"}
            tone={w.cepo ? "info" : "neutral"} sub="control de cambios" />
          <Stat label="Control de precios" value={w.priceControl ? "ACTIVO" : "no"}
            tone={w.priceControl ? "info" : "neutral"} sub="precios congelados" />
        </section>

        {/* ===== CONTROLES ===== */}
        <section style={S.controls}>
          <Lever accent="#5fd38a" title="EMITIR DINERO" icon="＋" hint="sube demanda · empuja precios"
            placeholder="ej. 7.5" suffix="%" onApply={(n) => emit(n)} btnStyle={S.emitBtn}
            presets={[["+2%", 2], ["+5%", 5], ["+10%", 10], ["+25%", 25]]} />

          <Lever accent="#6aa0ef" title="REDUCIR OFERTA" icon="－" hint="enfría · puede frenar actividad"
            placeholder="ej. 6" suffix="%" onApply={(n) => contract(n)} btnStyle={S.contractBtn}
            presets={[["−2%", 2], ["−5%", 5], ["−8%", 8], ["−15%", 15]]} />

          <Lever accent="#f5a623" title="TASA DE INTERÉS" icon="％" hint={`actual ${fmt(w.rate, 2)}% · escribí la nueva`}
            placeholder={`${fmt(w.rate, 1)}`} suffix="% objetivo" onApply={(n) => setRate(n)} btnStyle={S.rateBtn} mode="set"
            presets={[["0%", 0], ["5%", 5], ["15%", 15], ["40%", 40], ["80%", 80], ["150%", 150]]} />

          <Lever accent="#c8a8ff" title="ENCAJE BANCARIO" icon="🏦" hint={`actual ${fmt(w.encaje, 0)}% · frena el crédito`}
            placeholder={`${fmt(w.encaje, 0)}`} suffix="%" onApply={(n) => setEncaje(n)} btnStyle={S.encajeBtn} mode="set"
            presets={[["0%", 0], ["10%", 10], ["25%", 25], ["45%", 45]]} />

          <Lever accent="#7dd3a0" title="ARANCELES" icon="🚢" hint={`actual ${fmt(w.tariff, 0)}% · a las importaciones`}
            placeholder={`${fmt(w.tariff, 0)}`} suffix="%" onApply={(n) => setTariff(n)} btnStyle={S.tariffBtn} mode="set"
            presets={[["0%", 0], ["10%", 10], ["25%", 25], ["50%", 50], ["100%", 100]]} />

          <Lever accent="#ffd166" title="SALARIO MÍNIMO" icon="👷" hint="suba por decreto · cuidado con la espiral"
            placeholder="ej. 10" suffix="% suba" onApply={(n) => decreeWage(n)} btnStyle={S.wageBtn}
            presets={[["+5%", 5], ["+10%", 10], ["+20%", 20]]} />

          <Lever accent="#56c4d8" title="INTERVENIR EL DÓLAR" icon="＄"
            hint={w.reserves < 0.3 ? "⚠️ sin reservas" : `baja el dólar · gasta reservas (${fmt(w.reserves, 1)})`}
            placeholder="ej. 7" suffix="% baja" onApply={(n) => intervene(n)} btnStyle={S.fxBtn}
            disabled={w.reserves < 0.3} presets={[["3%", 3], ["7%", 7], ["15%", 15]]} />

          <div style={S.ctrlCol}>
            <div style={S.ctrlHead}><span style={{ color: "#ff8a6a" }}>⛓</span> MEDIDAS DE EMERGENCIA <span style={S.ctrlHint}>distorsionan la economía</span></div>
            <div style={S.toggleRow}>
              <button style={{ ...S.toggleBtn, ...(w.cepo ? S.toggleOn : {}) }} onClick={toggleCepo}>
                Cepo cambiario · {w.cepo ? "ON" : "OFF"}
              </button>
              <button style={{ ...S.toggleBtn, ...(w.priceControl ? S.toggleOn : {}) }} onClick={togglePC}>
                Control de precios · {w.priceControl ? "ON" : "OFF"}
              </button>
            </div>
            <div style={S.ctrlFoot}>El cepo frena el dólar oficial pero dispara el blue y la brecha. El control de precios congela la góndola pero genera desabastecimiento.</div>
          </div>
        </section>

        {/* ===== CHARTS + CALLE ===== */}
        <section style={S.midGrid}>
          <div style={S.panel}>
            <div style={S.panelTitle}>INFLACIÓN <span style={S.panelSub}>% mensual</span></div>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={w.history} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff8a3d" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#ff8a3d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#222633" strokeDasharray="2 4" />
                <XAxis dataKey="day" stroke="#555" tick={{ fontSize: 10, fill: "#777" }} />
                <YAxis stroke="#555" tick={{ fontSize: 10, fill: "#777" }} />
                <ReferenceLine y={0} stroke="#3a3f4d" />
                <Tooltip contentStyle={TT} labelFormatter={(d) => `Día ${d}`} formatter={(v) => [`${v}%`, "Inflación"]} />
                <Area type="monotone" dataKey="infl" stroke="#ff8a3d" strokeWidth={2} fill="url(#gI)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={S.panel}>
            <div style={S.panelTitle}>PIB vs DESEMPLEO</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={w.history} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#222633" strokeDasharray="2 4" />
                <XAxis dataKey="day" stroke="#555" tick={{ fontSize: 10, fill: "#777" }} />
                <YAxis stroke="#555" tick={{ fontSize: 10, fill: "#777" }} />
                <Tooltip contentStyle={TT} labelFormatter={(d) => `Día ${d}`} />
                <Line type="monotone" dataKey="gdp" name="PIB" stroke="#4dd68a" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="unemp" name="Desempleo" stroke="#6aa0ef" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...S.panel, ...S.streetPanel }}>
            <div style={S.panelTitle}>LA CALLE <span style={S.panelSub}>qué vive la gente</span></div>
            <div style={S.moodRow}>
              <span style={S.moodLabel}>Ánimo social</span>
              <div style={S.moodBar}>
                <div style={{ ...S.moodFill, width: `${w.confidence}%`, background: phase.color }} />
              </div>
            </div>
            <div style={S.newsList}>
              {w.news.length === 0 && <div style={S.newsEmpty}>Tomá una decisión y avanzá los meses para ver reaccionar a la población…</div>}
              {w.news.map((n, i) => (
                <div key={`${n.day}-${i}`} style={{ ...S.newsItem, opacity: 1 - i * 0.08, ...(n.alert ? S.newsAlert : {}) }}>
                  <span style={{ ...S.newsDay, color: n.alert ? "#ff8a3d" : PHASES[n.phase].color }}>M{n.day}</span>
                  <span>{n.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== PODER ADQUISITIVO ===== */}
        <section style={S.ppBar}>
          <div style={S.ppItem}>
            <span style={S.ppLabel}>Salario mensual</span>
            <span style={S.ppVal}>${fmt(w.wage, 0)}</span>
          </div>
          <div style={S.ppArrow}>→</div>
          <div style={S.ppItem}>
            <span style={S.ppLabel}>Canasta básica</span>
            <span style={S.ppVal}>${fmt(basket, 0)}</span>
          </div>
          <div style={S.ppArrow}>=</div>
          <div style={S.ppItem}>
            <span style={S.ppLabel}>Poder adquisitivo</span>
            <span style={{ ...S.ppVal, color: pp > 160 ? "#4dd68a" : pp > 90 ? "#ffb02e" : "#ff4d4d" }}>
              {fmt(pp, 0)}
              <span style={S.ppUnit}> {pp >= 100 ? "canastas" : "% de canasta"}</span>
            </span>
          </div>
          <div style={S.ppNote}>
            {pp > 180 ? "🟢 La gente vive con holgura." : pp > 110 ? "🟡 Llegan a fin de mes, pero ajustados." : pp > 80 ? "🟠 El sueldo casi no alcanza." : "🔴 No alcanza para lo básico: hay malestar."}
          </div>
        </section>

        {/* ===== INFORME ANUAL ===== */}
        <section style={{ marginBottom: 22 }}>
          <div style={S.secTitle}>
            INFORME ANUAL <span style={S.panelSub}>cierre de cada año (12 meses) · {w.reports.length} {w.reports.length === 1 ? "informe" : "informes"}</span>
          </div>
          {w.reports.length === 0 ? (
            <div style={S.reportEmpty}>
              📊 Al completar el primer año (mes 12) aparecerá acá el resumen con todos los datos: inflación, PIB, empleo, dinero, salarios, sector externo y un veredicto.
            </div>
          ) : (
            <div style={S.reportList}>
              {w.reports.map((r, i) => {
                const ph = PHASES[r.domPhase];
                return (
                  <div key={r.year} style={{ ...S.reportCard, ...(i === 0 ? { borderColor: ph.color, boxShadow: `0 0 28px -10px ${ph.glow}`, animation: "fadeUp .5s ease" } : {}) }}>
                    <div style={S.reportHead}>
                      <div>
                        <div style={S.reportMonth}>AÑO {r.year}</div>
                        <div style={S.reportDays}>meses {r.from}–{r.to}</div>
                      </div>
                      <span style={{ ...S.reportPhase, color: ph.color, borderColor: ph.color }}>{ph.label}</span>
                    </div>
                    <div style={S.reportGrid}>
                      <RInfo label="Inflación del año" value={`${r.monthInfl >= 0 ? "+" : ""}${fmt(r.monthInfl, 1)}%`}
                        color={r.monthInfl > 30 ? "#ff4d4d" : r.monthInfl > 12 ? "#ffb02e" : r.monthInfl < -2 ? "#56c4d8" : "#4dd68a"} />
                      <RInfo label="Crecim. PIB" value={`${r.monthGdp >= 0 ? "+" : ""}${fmt(r.monthGdp, 1)}%`}
                        color={r.monthGdp > 1.5 ? "#4dd68a" : r.monthGdp < -1.5 ? "#ff4d4d" : "#e8e4d8"} />
                      <RInfo label="PIB nominal" value={fmtMoney(r.nominalGDP)} />
                      <RInfo label="Base monetaria" value={fmtMoney(r.baseMoney)} sub={`${r.monthM >= 0 ? "+" : ""}${fmt(r.monthM, 1)}% año`} />
                      <RInfo label="Desempleo prom." value={`${fmt(r.avgUnemp, 1)}%`}
                        color={r.avgUnemp > 9 ? "#ff4d4d" : r.avgUnemp < 4 ? "#4dd68a" : "#e8e4d8"} />
                      <RInfo label="Ocupados / Sin empleo" value={`${fmtPop(r.employed)}`} sub={`${fmtPop(r.unemployed)} sin trabajo`} />
                      <RInfo label="Población" value={fmtPop(r.population ?? 0)}
                        sub={`${(r.popChange ?? 0) >= 0 ? "+" : ""}${fmt(r.popChange ?? 0, 2)}% año`}
                        color={(r.popChange ?? 0) > 0 ? "#4dd68a" : (r.popChange ?? 0) < -0.5 ? "#ff4d4d" : "#e8e4d8"} />
                      <RInfo label="Migración neta" value={`${(r.netMigration ?? 0) >= 0 ? "+" : ""}${fmt(r.netMigration ?? 0, 1)}%`}
                        sub={(r.netMigration ?? 0) >= 0 ? "llega gente" : "emigración"}
                        color={(r.netMigration ?? 0) >= 0 ? "#4dd68a" : "#ff8a3d"} />
                      <RInfo label="PIB per cápita" value={fmtMoney(r.gdpPerCap ?? 0)} sub="por persona" />
                      <RInfo label="Salarios" value={`${r.monthWage >= 0 ? "+" : ""}${fmt(r.monthWage, 1)}%`}
                        sub={`real ${r.realWageChg >= 0 ? "+" : ""}${fmt(r.realWageChg, 1)}%`}
                        color={r.realWageChg >= 0 ? "#4dd68a" : "#ff8a3d"} />
                      <RInfo label="Poder adquisit." value={`${fmt(r.pp, 0)}`} sub={r.pp >= 100 ? "canastas" : "% canasta"} />
                      <RInfo label="Dólar" value={r.fxRate >= 1000 ? fmtMoney(r.fxRate) : "$" + fmt(r.fxRate, 2)}
                        sub={`${r.monthFx >= 0 ? "+" : ""}${fmt(r.monthFx, 1)}% año`}
                        color={r.monthFx > 50 ? "#ff4d4d" : r.monthFx > 20 ? "#ffb02e" : "#e8e4d8"} />
                      <RInfo label="Brecha cambiaria" value={`${fmt(r.brecha ?? 0, 0)}%`}
                        color={(r.brecha ?? 0) > 30 ? "#ff4d4d" : (r.brecha ?? 0) < 8 ? "#4dd68a" : "#e8e4d8"}
                        sub={r.cepo ? "con cepo" : "sin cepo"} />
                      <RInfo label="Reservas" value={`${fmt(r.reserves, 1)}`} sub="meses import."
                        color={r.reserves < 2 ? "#ff4d4d" : r.reserves > 8 ? "#4dd68a" : "#e8e4d8"} />
                      <RInfo label="Riesgo país" value={`${fmtInt(r.risk)}`} sub="pb"
                        color={r.risk > 1500 ? "#ff4d4d" : r.risk < 500 ? "#4dd68a" : "#e8e4d8"} />
                      <RInfo label="Desabastec." value={`${fmt(r.shortage ?? 0, 0)}`}
                        color={(r.shortage ?? 0) > 50 ? "#ff4d4d" : "#e8e4d8"} sub={r.priceControl ? "precios congelados" : "góndolas"} />
                      <RInfo label="Aranceles" value={`${fmt(r.tariff ?? 0, 0)}%`} sub="importaciones" />
                      <RInfo label="Balanza com." value={`${(r.tradeBalance ?? 0) >= 0 ? "+" : ""}${fmt((r.tradeBalance ?? 0) * 100, 0)}`}
                        color={(r.tradeBalance ?? 0) > 0.03 ? "#4dd68a" : (r.tradeBalance ?? 0) < -0.03 ? "#ff4d4d" : "#e8e4d8"}
                        sub={(r.tradeBalance ?? 0) >= 0 ? "superávit" : "déficit"} />
                      <RInfo label="Pobreza prom." value={`${fmt(r.avgPov, 1)}%`}
                        color={r.avgPov > 40 ? "#ff4d4d" : r.avgPov < 20 ? "#4dd68a" : "#e8e4d8"} />
                      <RInfo label="Desigualdad" value={`${fmt(r.gini, 0)}`} sub="Gini" />
                      <RInfo label="Tasa interés" value={`${fmt(r.rate, 2)}%`} />
                      <RInfo label="Confianza prom." value={`${fmt(r.avgConf, 0)}`}
                        color={r.avgConf > 70 ? "#4dd68a" : r.avgConf < 40 ? "#ff4d4d" : "#e8e4d8"} />
                      <RInfo label="Nivel de precios" value={fmt(r.priceLevel, 0)} sub="índice (base 100)" />
                    </div>
                    <div style={S.reportVerdict}>{r.verdict}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ===== PRODUCTOS (MICRO) ===== */}
        <section>
          <div style={S.secTitle}>MERCADO · PRECIOS EN TIEMPO REAL <span style={S.panelSub}>microeconomía — {PRODUCTS.length} bienes</span></div>
          <div style={S.prodGrid}>
            {w.products.map((p) => {
              const meta = PRODUCTS.find((x) => x.id === p.id);
              const ch = ((p.price - p.prev) / Math.max(p.prev, 0.0001)) * 100;
              const up = ch > 0.02, down = ch < -0.02;
              return (
                <div key={p.id} style={{ ...S.prodCard, borderColor: up ? "rgba(255,138,61,.35)" : down ? "rgba(86,196,216,.35)" : "#252a36" }}>
                  <div style={S.prodTop}>
                    <span style={S.prodEmoji}>{meta.emoji}</span>
                    <span style={S.prodName}>{meta.name}</span>
                    {meta.ess && <span style={S.essTag}>básico</span>}
                  </div>
                  <div style={S.prodPrice}>${fmt(p.price, p.price >= 100 ? 0 : 2)}</div>
                  <div style={{ ...S.prodChange, color: up ? "#ff8a3d" : down ? "#56c4d8" : "#6b7080" }}>
                    {up ? "▲" : down ? "▼" : "■"} {fmt(Math.abs(ch), 2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer style={S.footer}>
          Simulación con fines educativos · modelo simplificado de teoría cuantitativa del dinero (MV = PY), ley de Okun y curva de oferta agregada.
        </footer>
      </div>

      {/* ===== INTRO ===== */}
      {!started && (
        <div style={S.intro}>
          <div style={S.introCard}>
            <div style={S.kicker}>SIMULADOR MACRO + MICRO</div>
            <h2 style={S.introTitle}>Estás al mando de la economía</h2>
            <p style={S.introText}>
              Manejás la <b style={{ color: "#5fd38a" }}>emisión</b>, la <b style={{ color: "#6aa0ef" }}>contracción</b> monetaria
              y la <b style={{ color: "#f5a623" }}>tasa de interés</b>. Cada decisión repercute en toda la población:
              precios, empleo, actividad y el bolsillo de la gente.
            </p>
            <ul style={S.introList}>
              <li><b>Emitís mucho</b> → boom y luego inflación / hiperinflación.</li>
              <li><b>Contraés de golpe</b> → bajan los precios pero llega la recesión.</li>
              <li><b>Buscás el punto justo</b> → equilibrio y pleno empleo.</li>
            </ul>
            <p style={S.introHint}>
              Vas a enfrentar <b style={{ color: "#56c4d8" }}>shocks reales</b> (crisis petrolera, sequías, pánico financiero, pandemias…), un <b style={{ color: "#56c4d8" }}>dólar</b> que se devalúa, reservas, riesgo país y pobreza. La <b style={{ color: "#56c4d8" }}>población</b> crece o emigra según cómo manejes el país. Cada 5 s pasa un mes y al cierre de cada año tenés un informe completo.
            </p>
            <button style={S.introBtn} onClick={() => { setStarted(true); setRunning(true); }}>▶ Iniciar simulación</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  const colors = { good: "#4dd68a", bad: "#ff4d4d", ok: "#cfc6a8", info: "#56c4d8", neutral: "#e8e4d8" };
  return (
    <div style={S.stat}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statVal, color: colors[tone] || colors.neutral }}>{value}</div>
      <div style={S.statSub}>{sub}</div>
    </div>
  );
}

function RInfo({ label, value, sub, color }) {
  return (
    <div style={S.rInfo}>
      <div style={S.rLabel}>{label}</div>
      <div style={{ ...S.rValue, color: color || "#e8e4d8" }}>{value}</div>
      {sub && <div style={S.rSub}>{sub}</div>}
    </div>
  );
}

function Lever({ accent, title, icon, hint, placeholder, suffix, onApply, presets, btnStyle, mode, disabled }) {
  const [val, setVal] = useState("");
  const apply = () => {
    const n = parseFloat(String(val).replace(",", "."));
    if (!isNaN(n)) { onApply(n); if (mode !== "set") setVal(""); }
  };
  return (
    <div style={{ ...S.ctrlCol, ...(disabled ? { opacity: 0.6 } : {}) }}>
      <div style={S.ctrlHead}><span style={{ color: accent }}>{icon}</span> {title} <span style={S.ctrlHint}>{hint}</span></div>
      <div style={S.inputRow}>
        <input
          style={S.numInput}
          value={val}
          inputMode="decimal"
          placeholder={placeholder}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
          disabled={disabled}
        />
        <span style={S.suffix}>{suffix}</span>
        <button style={{ ...S.applyBtn, color: accent, borderColor: accent }} onClick={apply} disabled={disabled}>Aplicar</button>
      </div>
      <div style={S.presetRow}>
        {presets.map(([label, value]) => (
          <button key={label} style={{ ...S.actBtn, ...btnStyle, ...(disabled ? S.btnDisabled : {}) }}
            onClick={() => onApply(value)} disabled={disabled}>{label}</button>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
   ESTILOS
   ========================================================================= */
const TT = { background: "#11141c", border: "1px solid #2a2f3d", borderRadius: 8, fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#e8e4d8" };

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box;}
::selection{background:#f5a62355;}
button{font-family:'IBM Plex Mono',monospace;cursor:pointer;transition:transform .12s ease, filter .15s ease, background .15s ease;}
button:hover{filter:brightness(1.12);}
button:active{transform:translateY(1px) scale(.985);}
button:disabled{cursor:not-allowed;}
input{font-family:'IBM Plex Mono',monospace;}
input:focus{border-color:#f5a623 !important;box-shadow:0 0 0 2px rgba(245,166,35,.18);}
input::placeholder{color:#5a6070;}
::-webkit-scrollbar{width:8px;height:8px;}
::-webkit-scrollbar-thumb{background:#2a2f3d;border-radius:4px;}
@keyframes dayPop{0%{transform:scale(1.35);opacity:.3;}100%{transform:scale(1);opacity:1;}}
@keyframes flashIn{0%{opacity:0;}30%{opacity:1;}100%{opacity:0;}}
@keyframes fadeUp{0%{opacity:0;transform:translateY(8px);}100%{opacity:1;transform:translateY(0);}}
@keyframes shockPulse{0%,100%{box-shadow:0 0 18px -10px currentColor;}50%{box-shadow:0 0 32px -6px currentColor;}}
`;

const S = {
  root: { position: "relative", minHeight: "100vh", background: "#0a0c11", color: "#e8e4d8", fontFamily: "'IBM Plex Mono', monospace", overflowX: "hidden" },
  shockBanner: { display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", marginBottom: 18, border: "1px solid", borderRadius: 12, background: "linear-gradient(90deg,#1a1410,#0e1118)", animation: "fadeUp .4s ease" },
  shockEmoji: { fontSize: 26 },
  shockName: { fontSize: 13, letterSpacing: 1, fontWeight: 600 },
  shockDesc: { fontSize: 12, color: "#aab0bd", marginTop: 2 },
  shockDays: { fontSize: 12, color: "#cdd2dd", whiteSpace: "nowrap", fontWeight: 600 },
  grid: { position: "fixed", inset: 0, backgroundImage: "linear-gradient(#ffffff06 1px,transparent 1px),linear-gradient(90deg,#ffffff06 1px,transparent 1px)", backgroundSize: "44px 44px", pointerEvents: "none" },
  glow: { position: "fixed", inset: 0, pointerEvents: "none", transition: "background .8s ease" },
  flash: { position: "fixed", inset: 0, pointerEvents: "none", animation: "flashIn .65s ease", zIndex: 5 },
  shell: { position: "relative", maxWidth: 1180, margin: "0 auto", padding: "26px 18px 60px", zIndex: 2 },

  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 20 },
  kicker: { fontSize: 11, letterSpacing: 3, color: "#7c8294", textTransform: "uppercase" },
  title: { fontFamily: "'Instrument Serif', serif", fontSize: 52, lineHeight: 1, margin: "4px 0 0", fontWeight: 400, color: "#f3ead2", letterSpacing: 0.5 },
  headRight: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" },
  dayBox: { display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 16px", border: "1px solid #2a2f3d", borderRadius: 10, background: "#11141c" },
  popBox: { display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 14px", border: "1px solid #2a2f3d", borderRadius: 10, background: "#11141c" },
  popNum: { fontFamily: "'Instrument Serif', serif", fontSize: 24, lineHeight: 1.25, color: "#56c4d8" },
  dayLabel: { fontSize: 9, letterSpacing: 3, color: "#7c8294" },
  dayNum: { fontFamily: "'Instrument Serif', serif", fontSize: 28, lineHeight: 1.05, color: "#f5a623", animation: "dayPop .4s ease" },
  transport: { display: "flex", gap: 8 },
  ctrlBtn: { padding: "9px 13px", fontSize: 12, color: "#cdd2dd", background: "#161a23", border: "1px solid #2a2f3d", borderRadius: 9 },
  ctrlOn: { color: "#0a0c11", background: "#f5a623", borderColor: "#f5a623", fontWeight: 600 },

  phase: { marginBottom: 20, padding: "16px 20px", border: "1px solid", borderRadius: 14, background: "linear-gradient(180deg,#12151d,#0e1118)", transition: "border-color .6s, box-shadow .6s" },
  phaseTop: { display: "flex", alignItems: "center", gap: 8 },
  phaseDot: { width: 9, height: 9, borderRadius: "50%" },
  phaseLabel: { fontSize: 10, letterSpacing: 3, color: "#7c8294" },
  phaseName: { fontFamily: "'Instrument Serif', serif", fontSize: 40, lineHeight: 1.05, margin: "6px 0 4px", transition: "color .5s" },
  phaseDesc: { fontSize: 13, color: "#aab0bd", maxWidth: 720 },

  macroGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 18 },
  stat: { padding: "13px 14px", background: "#11141c", border: "1px solid #20242f", borderRadius: 12 },
  statLabel: { fontSize: 10, letterSpacing: 1.5, color: "#7c8294", textTransform: "uppercase" },
  statVal: { fontFamily: "'Instrument Serif', serif", fontSize: 30, lineHeight: 1.1, margin: "4px 0 2px" },
  statSub: { fontSize: 11, color: "#646a78" },

  controls: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12, marginBottom: 20 },
  ctrlCol: { padding: "14px 14px 16px", background: "#11141c", border: "1px solid #20242f", borderRadius: 12 },
  ctrlHead: { fontSize: 12, letterSpacing: 1, color: "#dfe3ea", marginBottom: 12, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" },
  ctrlHint: { fontSize: 10, color: "#646a78", letterSpacing: 0, marginLeft: "auto" },
  btnRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  actBtn: { flex: 1, minWidth: 56, padding: "11px 6px", fontSize: 14, fontWeight: 600, borderRadius: 9, border: "1px solid" },
  emitBtn: { color: "#5fd38a", background: "rgba(95,211,138,.08)", borderColor: "rgba(95,211,138,.3)" },
  contractBtn: { color: "#6aa0ef", background: "rgba(106,160,239,.08)", borderColor: "rgba(106,160,239,.3)" },
  rateBtn: { color: "#f5a623", background: "rgba(245,166,35,.07)", borderColor: "rgba(245,166,35,.28)", fontSize: 12 },
  encajeBtn: { color: "#c8a8ff", background: "rgba(200,168,255,.08)", borderColor: "rgba(200,168,255,.3)", fontSize: 12 },
  tariffBtn: { color: "#7dd3a0", background: "rgba(125,211,160,.08)", borderColor: "rgba(125,211,160,.3)", fontSize: 12 },
  wageBtn: { color: "#ffd166", background: "rgba(255,209,102,.08)", borderColor: "rgba(255,209,102,.3)", fontSize: 12 },
  fxBtn: { color: "#56c4d8", background: "rgba(86,196,216,.08)", borderColor: "rgba(86,196,216,.3)", fontSize: 13 },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed", filter: "grayscale(0.6)" },
  ctrlFoot: { fontSize: 10.5, color: "#646a78", marginTop: 10, lineHeight: 1.4 },
  inputRow: { display: "flex", gap: 6, alignItems: "center", marginBottom: 9 },
  numInput: { flex: 1, minWidth: 0, padding: "9px 10px", fontSize: 14, color: "#f3ead2", background: "#0c0f16", border: "1px solid #2a2f3d", borderRadius: 8, outline: "none" },
  suffix: { fontSize: 10.5, color: "#7c8294", whiteSpace: "nowrap" },
  applyBtn: { padding: "9px 11px", fontSize: 12, fontWeight: 600, background: "transparent", border: "1px solid", borderRadius: 8, whiteSpace: "nowrap" },
  presetRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  toggleRow: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 },
  toggleBtn: { padding: "11px 12px", fontSize: 12.5, fontWeight: 600, color: "#cdd2dd", background: "#161a23", border: "1px solid #2a2f3d", borderRadius: 9, textAlign: "left" },
  toggleOn: { color: "#0a0c11", background: "#ff8a6a", borderColor: "#ff8a6a" },

  midGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 },
  panel: { padding: 14, background: "#11141c", border: "1px solid #20242f", borderRadius: 12 },
  panelTitle: { fontSize: 11, letterSpacing: 2, color: "#aab0bd", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  panelSub: { fontSize: 10, color: "#646a78", letterSpacing: 0.5, fontWeight: 400 },
  streetPanel: { display: "flex", flexDirection: "column" },
  moodRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  moodLabel: { fontSize: 11, color: "#7c8294", whiteSpace: "nowrap" },
  moodBar: { flex: 1, height: 8, background: "#1c2029", borderRadius: 5, overflow: "hidden" },
  moodFill: { height: "100%", borderRadius: 5, transition: "width .6s ease, background .6s ease" },
  newsList: { display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1, maxHeight: 132 },
  newsEmpty: { fontSize: 12, color: "#646a78", lineHeight: 1.5 },
  newsItem: { display: "flex", gap: 8, fontSize: 12, color: "#c4c9d4", lineHeight: 1.4, animation: "fadeUp .4s ease" },
  newsAlert: { color: "#ffd9b0", fontWeight: 500 },
  newsDay: { fontWeight: 600, flexShrink: 0 },

  ppBar: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "14px 18px", background: "linear-gradient(90deg,#12151d,#0e1118)", border: "1px solid #20242f", borderRadius: 12, marginBottom: 22 },
  ppItem: { display: "flex", flexDirection: "column" },
  ppLabel: { fontSize: 10, letterSpacing: 1, color: "#7c8294", textTransform: "uppercase" },
  ppVal: { fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "#f3ead2" },
  ppUnit: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#7c8294" },
  ppArrow: { color: "#4a4f5c", fontSize: 20 },
  ppNote: { marginLeft: "auto", fontSize: 12, color: "#c4c9d4" },

  secTitle: { fontSize: 11, letterSpacing: 2, color: "#aab0bd", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  prodGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(132px,1fr))", gap: 10 },
  prodCard: { padding: "11px 12px", background: "#11141c", border: "1px solid #252a36", borderRadius: 11, transition: "border-color .4s" },
  prodTop: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 },
  prodEmoji: { fontSize: 16 },
  prodName: { fontSize: 11.5, color: "#c4c9d4", lineHeight: 1.1 },
  essTag: { fontSize: 8, letterSpacing: 0.5, color: "#7c8294", border: "1px solid #2a2f3d", borderRadius: 4, padding: "1px 4px", marginLeft: "auto" },
  prodPrice: { fontFamily: "'Instrument Serif', serif", fontSize: 23, color: "#f3ead2", lineHeight: 1 },
  prodChange: { fontSize: 11, marginTop: 3 },

  reportEmpty: { padding: "20px 18px", background: "#11141c", border: "1px dashed #2a2f3d", borderRadius: 12, fontSize: 13, color: "#8a90a0", lineHeight: 1.6 },
  reportList: { display: "flex", flexDirection: "column", gap: 12 },
  reportCard: { padding: "16px 18px", background: "linear-gradient(180deg,#13161f,#0e1118)", border: "1px solid #20242f", borderRadius: 14, transition: "border-color .4s" },
  reportHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  reportMonth: { fontFamily: "'Instrument Serif', serif", fontSize: 26, color: "#f3ead2", lineHeight: 1 },
  reportDays: { fontSize: 10, letterSpacing: 1, color: "#7c8294", marginTop: 2 },
  reportPhase: { fontSize: 11, letterSpacing: 1, padding: "4px 10px", border: "1px solid", borderRadius: 20, whiteSpace: "nowrap" },
  reportGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))", gap: 12, marginBottom: 14 },
  rInfo: {},
  rLabel: { fontSize: 9.5, letterSpacing: 0.8, color: "#7c8294", textTransform: "uppercase", lineHeight: 1.2 },
  rValue: { fontFamily: "'Instrument Serif', serif", fontSize: 20, lineHeight: 1.15, marginTop: 3 },
  rSub: { fontSize: 10, color: "#646a78", marginTop: 1 },
  reportVerdict: { fontSize: 13, color: "#d4d8e0", paddingTop: 12, borderTop: "1px solid #20242f", lineHeight: 1.5 },

  footer: { marginTop: 30, fontSize: 11, color: "#565c6a", textAlign: "center", lineHeight: 1.5 },

  intro: { position: "fixed", inset: 0, background: "rgba(6,8,12,.82)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 },
  introCard: { maxWidth: 480, padding: "30px 32px", background: "linear-gradient(180deg,#13161f,#0d1016)", border: "1px solid #2a2f3d", borderRadius: 18, boxShadow: "0 30px 80px -20px #000" },
  introTitle: { fontFamily: "'Instrument Serif', serif", fontSize: 36, fontWeight: 400, margin: "6px 0 12px", color: "#f3ead2", lineHeight: 1.05 },
  introText: { fontSize: 13.5, color: "#b6bcc8", lineHeight: 1.6, marginBottom: 14 },
  introList: { fontSize: 13, color: "#aab0bd", lineHeight: 1.9, paddingLeft: 18, margin: "0 0 14px" },
  introHint: { fontSize: 12, color: "#7c8294", marginBottom: 20 },
  introBtn: { width: "100%", padding: "14px", fontSize: 15, fontWeight: 600, color: "#0a0c11", background: "#f5a623", border: "none", borderRadius: 11 },
};
