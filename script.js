// Global variables for charts.
let sensitivityChart = null;
let summaryChart = null;

// Toggle model section based on dropdown selection.
function toggleSection() {
  const model = document.getElementById('modelSelect').value;
  document.getElementById('simpleSection').style.display = (model === 'simple') ? 'block' : 'none';
  document.getElementById('advancedSection').style.display = (model === 'advanced') ? 'block' : 'none';
  document.getElementById('customSection').style.display = (model === 'custom') ? 'block' : 'none';
}

// Dark mode toggle.
function toggleTheme() {
  document.body.classList.toggle('dark');
}

/* Utility: Clamp value */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/* Sigmoid-based risk mapping (returns a value between 1 and 10) */
function calculateRiskLevel(metric, metricMin, metricMax) {
  const mid = (metricMin + metricMax) / 2;
  const alpha = 10 / (metricMax - metricMin);
  const sigmoid = 1 / (1 + Math.exp(-alpha * (metric - mid)));
  return 1 + 9 * sigmoid;
}

/* Map risk level to stop loss percentage and TP multiplier */
function riskParameters(riskLevel) {
  const stopLossPct = 30 - (riskLevel - 1) * (20 / 9);
  const tpMultiplier = 3 - (riskLevel - 1) * (2 / 9);
  return { stopLossPct, tpMultiplier };
}

/* Convert risk level to qualitative label */
function riskLabel(riskLevel) {
  if (riskLevel <= 2) return "Very Favorable";
  if (riskLevel <= 4) return "Favorable";
  if (riskLevel <= 6) return "Neutral";
  if (riskLevel <= 8) return "Risky";
  return "Very Risky";
}

/* SIMPLE MODEL CALCULATION */
function calculateSimple() {
  const P = parseFloat(document.getElementById('s_price').value);
  const delta = parseFloat(document.getElementById('s_delta').value);
  const ATR = parseFloat(document.getElementById('s_atr').value);
  const T_days = parseFloat(document.getElementById('s_tdays').value);
  const k = parseFloat(document.getElementById('s_k').value);
  
  // New inputs for option type and transaction
  const optionType = document.getElementById('s_optionType').value; // "call" or "put"
  const transaction = document.getElementById('s_transaction').value; // "buy" or "sell"
  
  // Basic risk factor
  let R = delta * ATR;
  let SL, TP;
  
  if (optionType === "call" && transaction === "buy") {
    SL = P - R;
    TP = P + k * R;
  } else if (optionType === "call" && transaction === "sell") {
    SL = P + R;
    TP = P - k * R;
  } else if (optionType === "put" && transaction === "buy") {
    SL = P + R;
    TP = P - k * R;
  } else if (optionType === "put" && transaction === "sell") {
    SL = P - R;
    TP = P + k * R;
  }
  
  // Compute a simple risk metric and risk level
  const riskMetric = R / P;
  const riskLevel = calculateRiskLevel(riskMetric, 0.1, 0.5);
  const qualitative = riskLabel(riskLevel);
  
  document.getElementById('simpleResult').innerHTML = `
    <strong>Simple Model Results:</strong><br>
    Risk Metric: ${riskMetric.toFixed(3)}<br>
    Auto Risk Level: ${riskLevel.toFixed(1)} (${qualitative})<br>
    Stop Loss: $${SL.toFixed(2)}<br>
    Take Profit: $${TP.toFixed(2)}
  `;
  
  updateSummaryChart(P, T_days, SL, TP, 0, "simple");
}

/* ADVANCED MODEL CALCULATION */
function calculateAdvanced() {
  const P = parseFloat(document.getElementById('a_price').value);
  const delta = parseFloat(document.getElementById('a_delta').value);
  const theta = parseFloat(document.getElementById('a_theta').value);
  const IV = parseFloat(document.getElementById('a_iv').value);
  const ATR = parseFloat(document.getElementById('a_atr').value);
  const MS = parseFloat(document.getElementById('a_ms').value);
  const S = parseFloat(document.getElementById('a_stock').value);
  const T_days = parseFloat(document.getElementById('a_tdays').value);
  const OI = parseFloat(document.getElementById('a_oi').value);
  const contracts = parseFloat(document.getElementById('a_contracts').value);
  
  // New inputs for option type and transaction
  const optionType = document.getElementById('a_optionType').value; // "call" or "put"
  const transaction = document.getElementById('a_transaction').value; // "buy" or "sell"
  
  const numerator = delta * ATR * (S / P) * Math.sqrt(OI + 1) *
                    Math.log(T_days + 1) * (1 + ((MS - 50) / 50));
  const denominator = P * Math.sqrt(theta) * Math.exp(IV / 100);
  const Q = Math.sqrt(numerator / denominator);
  
  // Scaling factor: using number of contracts as eta
  const eta = contracts;
  
  let SL, TP;
  if (optionType === "call" && transaction === "buy") {
    SL = P * (1 - eta * Q);
    let TP_computed = P * (1 + eta * Q);
    // Cap TP so it does not exceed a max increase (e.g., 50% above P)
    const maxTP = P * 1.5;
    TP = Math.min(TP_computed, maxTP);
  } else if (optionType === "call" && transaction === "sell") {
    SL = P * (1 + eta * Q);
    let TP_computed = P * (1 - eta * Q);
    // Cap TP so it does not go below a minimum (e.g., 70% of P)
    const minTP = P * 0.7;
    TP = Math.max(TP_computed, minTP);
  } else if (optionType === "put" && transaction === "buy") {
    // For put buys, the logic is inverted relative to calls
    SL = P * (1 + eta * Q);
    let TP_computed = P * (1 - eta * Q);
    const minTP = P * 0.7;
    TP = Math.max(TP_computed, minTP);
  } else if (optionType === "put" && transaction === "sell") {
    SL = P * (1 - eta * Q);
    let TP_computed = P * (1 + eta * Q);
    const maxTP = P * 1.5;
    TP = Math.min(TP_computed, maxTP);
  }
  
  const riskLevel = calculateRiskLevel(Q, 0.2, 1.0);
  const qualitative = riskLabel(riskLevel);
  const rrRatio = ((TP - P) / (P - SL)).toFixed(2);
  
  document.getElementById('advancedResult').innerHTML = `
    <strong>Advanced Model Results:</strong><br>
    Composite Sensitivity Score (Q): ${Q.toFixed(4)}<br>
    Auto Risk Level: ${riskLevel.toFixed(1)} (${qualitative})<br>
    Stop Loss: $${SL.toFixed(2)}<br>
    Take Profit: $${TP.toFixed(2)}<br>
    Risk/Reward Ratio: ${rrRatio}
  `;
  
  updateSummaryChart(P, T_days, SL, TP, theta, "advanced");
}

/* CUSTOM (WEIGHTED) MODEL CALCULATION */
function calculateCustom() {
  const P = parseFloat(document.getElementById('c_price').value);
  const theta = parseFloat(document.getElementById('c_theta').value);
  const IV = parseFloat(document.getElementById('c_iv').value);
  const contracts = parseFloat(document.getElementById('c_contracts').value);
  
  const delta = parseFloat(document.getElementById('c_delta').value);
  const w_delta = parseFloat(document.getElementById('w_delta').value);
  
  const ATR = parseFloat(document.getElementById('c_atr').value);
  const w_atr = parseFloat(document.getElementById('w_atr').value);
  
  const S = parseFloat(document.getElementById('c_stock').value);
  const optPriceForRatio = parseFloat(document.getElementById('c_optionPrice').value);
  const w_ratio = parseFloat(document.getElementById('w_ratio').value);
  
  const OI = parseFloat(document.getElementById('c_oi').value);
  const w_oi = parseFloat(document.getElementById('w_oi').value);
  
  const T_days = parseFloat(document.getElementById('c_tdays').value);
  
  const MS = parseFloat(document.getElementById('c_ms').value);
  const w_ms = parseFloat(document.getElementById('w_ms').value);
  
  // New inputs for option type and transaction
  const optionType = document.getElementById('c_optionType').value; // "call" or "put"
  const transaction = document.getElementById('c_transaction').value; // "buy" or "sell"
  
  const slMult = parseFloat(document.getElementById('c_slMult').value);
  const tpMult = parseFloat(document.getElementById('c_tpMult').value);
  
  const weightedDelta = w_delta * delta;
  const weightedATR = w_atr * ATR;
  const weightedRatio = w_ratio * (S / optPriceForRatio);
  const weightedOI = Math.sqrt(w_oi * (OI + 1));
  const weightedT = Math.log(T_days + 1);
  const weightedMS = 1 + (w_ms * (MS - 50) / 50);
  
  const numerator = weightedDelta * weightedATR * weightedRatio * weightedOI * weightedT * weightedMS;
  const denominator = P * theta * Math.exp(IV / 100);
  const Q_custom = Math.sqrt(numerator / denominator);
  
  const riskLevel = calculateRiskLevel(Q_custom, 0.2, 1.0);
  const qualitative = riskLabel(riskLevel);
  const { stopLossPct, tpMultiplier } = riskParameters(riskLevel);
  const eta = contracts;
  
  let SL, TP;
  if (optionType === "call" && transaction === "buy") {
    SL = P * (1 - slMult * eta * Q_custom);
    let TP_computed = P * (1 + tpMultiplier * eta * Q_custom);
    const maxTP = P * 1.5;
    TP = Math.min(TP_computed, maxTP);
  } else if (optionType === "call" && transaction === "sell") {
    SL = P * (1 + slMult * eta * Q_custom);
    let TP_computed = P * (1 - tpMultiplier * eta * Q_custom);
    const minTP = P * 0.7;
    TP = Math.max(TP_computed, minTP);
  } else if (optionType === "put" && transaction === "buy") {
    SL = P * (1 + slMult * eta * Q_custom);
    let TP_computed = P * (1 - tpMultiplier * eta * Q_custom);
    const minTP = P * 0.7;
    TP = Math.max(TP_computed, minTP);
  } else if (optionType === "put" && transaction === "sell") {
    SL = P * (1 - slMult * eta * Q_custom);
    let TP_computed = P * (1 + tpMultiplier * eta * Q_custom);
    const maxTP = P * 1.5;
    TP = Math.min(TP_computed, maxTP);
  }
  
  const rrRatio = ((TP - P) / (P - SL)).toFixed(2);
  
  document.getElementById('customResult').innerHTML = `
    <strong>Custom Model Results:</strong><br>
    Weighted Composite Score (Q_custom): ${Q_custom.toFixed(4)}<br>
    Auto Risk Level: ${riskLevel.toFixed(1)} (${qualitative})<br>
    Stop Loss: $${SL.toFixed(2)}<br>
    Take Profit: $${TP.toFixed(2)}<br>
    Risk/Reward Ratio: ${rrRatio}
  `;
  
  updateSummaryChart(P, T_days, SL, TP, theta, "advanced");
}
