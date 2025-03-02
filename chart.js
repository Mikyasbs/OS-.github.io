// Chart-related Functions

/* Update the Summary Chart.
   X-axis: Days Till Expiration.
   Datasets:
     - Red: Computed Stop Loss (horizontal)
     - Green: Computed Take Profit (horizontal)
     - Yellow: Worst-case decay curve.
   For Simple: worst-case decay is linear from P to 0.
   For Advanced/Custom: worst-case decay uses theta:
     Worst(t) = P * [1 - (t/T_days)^α], where α = 1 + (θ/100).
*/
function updateSummaryChart(P, T_days, stopLoss, takeProfit, theta, modelType) {
  const ctx = document.getElementById('summaryChart').getContext('2d');
  const steps = 50;
  const days = [];
  const worstValues = [];
  for (let i = 0; i <= steps; i++) {
    const t = (T_days * i) / steps;
    days.push(t.toFixed(1));
    let worst;
    if (modelType === "simple") {
      worst = P * (1 - t / T_days);
    } else {
      const alpha = 1 + theta / 100;
      worst = P * (1 - Math.pow(t / T_days, alpha));
    }
    worstValues.push(worst);
  }
  const stopLossData = Array(steps + 1).fill(stopLoss);
  const takeProfitData = Array(steps + 1).fill(takeProfit);
  
  const data = {
    labels: days,
    datasets: [
      {
        label: "Stop Loss",
        data: stopLossData,
        borderColor: "rgba(255, 99, 132, 1)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      },
      {
        label: "Take Profit",
        data: takeProfitData,
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      },
      {
        label: "Worst-case Scenario",
        data: worstValues,
        borderColor: "rgba(255, 206, 86, 1)",
        backgroundColor: "rgba(255, 206, 86, 0.2)",
        fill: false,
        borderWidth: 2,
        pointRadius: 0
      }
    ]
  };
  
  if (summaryChart !== null) {
    summaryChart.data = data;
    summaryChart.update();
  } else {
    summaryChart = new Chart(ctx, {
      type: 'line',
      data: data,
      options: {
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { title: { display: true, text: "Days Till Expiration" } },
          y: { title: { display: true, text: "Option Value ($)" } }
        }
      }
    });
  }
}

/* Sensitivity Chart for Custom Model.
   This chart plots how varying Delta Weight (w_delta) affects Q_custom.
*/
function updateSensitivityChart() {
  const P = parseFloat(document.getElementById('c_price').value) || 1;
  const theta = parseFloat(document.getElementById('c_theta').value) || 1;
  const iv = parseFloat(document.getElementById('c_iv').value) || 10;
  const contracts = parseFloat(document.getElementById('c_contracts').value) || 1;
  
  const delta = parseFloat(document.getElementById('c_delta').value) || 0.5;
  const atr = parseFloat(document.getElementById('c_atr').value) || 1;
  const w_atr = parseFloat(document.getElementById('w_atr').value) || 1;
  
  const S = parseFloat(document.getElementById('c_stock').value) || 1;
  const optPriceForRatio = parseFloat(document.getElementById('c_optionPrice').value) || 1;
  const w_ratio = parseFloat(document.getElementById('w_ratio').value) || 1;
  
  const OI = parseFloat(document.getElementById('c_oi').value) || 1;
  const w_oi = parseFloat(document.getElementById('w_oi').value) || 1;
  
  const T_days = parseFloat(document.getElementById('c_tdays').value) || 1;
  const w_tdays = parseFloat(document.getElementById('w_tdays').value) || 1;
  
  const ms = parseFloat(document.getElementById('c_ms').value) || 50;
  const w_ms = parseFloat(document.getElementById('w_ms').value) || 1;
  
  const w_delta_vals = [];
  const Q_vals = [];
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const w_delta_val = 0.1 + (2.9 * i / steps);
    w_delta_vals.push(w_delta_val.toFixed(2));
    
    const numerator = (w_delta_val * delta) * (w_atr * atr) * (w_ratio * (S / optPriceForRatio)) *
                      Math.sqrt(w_oi * (OI + 1)) * Math.log(w_tdays * (T_days + 1)) *
                      (1 + (w_ms * (ms - 50) / 50));
    const denom = P * theta * Math.exp(iv / 100);
    const Q_custom = Math.sqrt(numerator / denom);
    Q_vals.push(Q_custom);
  }
  
  const ctx = document.getElementById('sensitivityChart').getContext('2d');
  if (sensitivityChart !== null) {
    sensitivityChart.destroy();
  }
  sensitivityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: w_delta_vals,
      datasets: [{
        label: 'Composite Score Q_custom',
        data: Q_vals,
        borderColor: 'rgba(75, 192, 192, 1)',
        fill: false,
        tension: 0.1
      }]
    },
    options: {
      scales: {
        x: { title: { display: true, text: 'Delta Weight (w_delta)' } },
        y: { title: { display: true, text: 'Q_custom' } }
      }
    }
  });
}
