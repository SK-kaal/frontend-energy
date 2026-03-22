const API_URL = "http://localhost:5000/api/readings";
const STORAGE_RATE_KEY = "energy-monitor-rate-gbp-per-kwh";
const UK_AVERAGE_RATE = 0.2635;

let powerChart;
let currentChart;
let costChart;

// --- Fixed demo data: 24 hours, readings every 30 min (48 points) ---
const DEMO_READINGS = (() => {
  const baseDate = new Date("2025-03-22T00:00:00");
  const MS_PER_30MIN = 30 * 60 * 1000;
  const powerByHour = [
    65, 60, 55, 70, 85, 120,
    350, 420, 380, 2200, 2100, 180,
    150, 160, 500, 480, 450, 140,
    120, 95, 320, 380, 110, 75,
  ];
  const readings = [];
  for (let i = 0; i < 48; i++) {
    const t = new Date(baseDate.getTime() + i * MS_PER_30MIN);
    const hourIdx = Math.floor((i * 30) / 60) % 24;
    const p = powerByHour[hourIdx] + (Math.floor(i / 2) % 2 ? 20 : -15);
    readings.push({
      timestamp: t.toISOString(),
      current: Number((p / 230).toFixed(3)),
      powerWatts: Math.max(0, p),
      deviceId: "mkr1010_01",
    });
  }
  return readings;
})();

// --- Data fetching ---
async function fetchReadings() {
  const useDemo = document.getElementById("demoDataToggle")?.checked === true;

  if (useDemo) {
    return [...DEMO_READINGS];
  }

  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.log("No readings found");
      return [];
    }
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return data.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
  } catch (error) {
    console.warn("API unavailable:", error.message);
    return [];
  }
}

// --- Cost calculation ---
function getStoredRate() {
  const stored = localStorage.getItem(STORAGE_RATE_KEY);
  return stored ? parseFloat(stored) : null;
}

function getRate() {
  const input = document.getElementById("rateInput");
  const val = input ? parseFloat(input.value) : NaN;
  if (!isNaN(val) && val > 0) {
    localStorage.setItem(STORAGE_RATE_KEY, String(val));
    return val;
  }
  const stored = getStoredRate();
  return stored != null ? stored : UK_AVERAGE_RATE;
}

function calculateCostPerHour(powerWatts, rateGbpPerKwh) {
  if (!rateGbpPerKwh || rateGbpPerKwh <= 0) return null;
  const kwh = powerWatts / 1000;
  return kwh * rateGbpPerKwh;
}

function calculateCumulativeCosts(data, rateGbpPerKwh) {
  if (!rateGbpPerKwh || !data || data.length < 2) return data?.map(() => 0) ?? [];
  const costs = [0];
  for (let i = 1; i < data.length; i++) {
    const prev = new Date(data[i - 1].timestamp).getTime();
    const curr = new Date(data[i].timestamp).getTime();
    const hours = (curr - prev) / (1000 * 3600);
    const kwh = (Number(data[i].powerWatts) / 1000) * hours;
    costs.push(costs[i - 1] + kwh * rateGbpPerKwh);
  }
  return costs;
}

// --- UI update ---
function updateSummaryCards(data) {
  if (!data || data.length === 0) {
    document.getElementById("latestCurrent").textContent = "-- A";
    document.getElementById("latestPower").textContent = "-- W";
    document.getElementById("latestCost").textContent = "--";
    return;
  }

  const latest = data[data.length - 1];
  const rate = getRate();
  const cost = calculateCostPerHour(Number(latest.powerWatts), rate);

  document.getElementById("latestCurrent").textContent = `${Number(latest.current).toFixed(2)} A`;
  document.getElementById("latestPower").textContent = `${Number(latest.powerWatts).toFixed(2)} W`;
  document.getElementById("latestCost").textContent =
    cost != null ? `£${cost.toFixed(4)}/hr` : "--";
}

function updateCharts(data) {
  if (!data || data.length === 0) {
    if (powerChart) powerChart.destroy();
    if (currentChart) currentChart.destroy();
    if (costChart) costChart.destroy();
    powerChart = currentChart = costChart = null;
    return;
  }

  const timestamps = data.map((item) => new Date(item.timestamp).getTime());
  const currentValues = data.map((item) => Number(item.current));
  const powerValues = data.map((item) => Number(item.powerWatts));
  const rate = getRate();
  const costValues =
    rate != null && rate > 0
      ? calculateCumulativeCosts(data, rate)
      : data.map((item) => Number(item.estimatedCost || 0));

  const costLabel = rate != null ? "Cumulative Cost (£)" : "Estimated Cost (£)";
  const maxTime = Math.max(...timestamps);
  const dayMs = 24 * 60 * 60 * 1000;
  const xMin = maxTime - dayMs;
  const xMax = maxTime;

  if (powerChart) {
    powerChart.data.datasets[0].data = timestamps.map((t, i) => ({ x: t, y: powerValues[i] }));
    powerChart.options.scales.x.min = xMin;
    powerChart.options.scales.x.max = xMax;
    powerChart.update("none");
  } else {
    powerChart = createChart("powerChart", "Power (W)", timestamps, powerValues, xMin, xMax);
  }

  if (currentChart) {
    currentChart.data.datasets[0].data = timestamps.map((t, i) => ({ x: t, y: currentValues[i] }));
    currentChart.options.scales.x.min = xMin;
    currentChart.options.scales.x.max = xMax;
    currentChart.update("none");
  } else {
    currentChart = createChart("currentChart", "Current (A)", timestamps, currentValues, xMin, xMax);
  }

  if (costChart) {
    costChart.data.datasets[0].data = timestamps.map((t, i) => ({ x: t, y: costValues[i] }));
    costChart.data.datasets[0].label = costLabel;
    costChart.options.scales.x.min = xMin;
    costChart.options.scales.x.max = xMax;
    costChart.update("none");
  } else {
    costChart = createChart("costChart", costLabel, timestamps, costValues, xMin, xMax);
  }
}

function createChart(canvasId, label, timestamps, values, xMin, xMax) {
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const ctx = el.getContext("2d");
  const chartData = timestamps.map((t, i) => ({ x: t, y: values[i] }));
  return new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label,
          data: chartData,
          borderWidth: 2,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          type: "time",
          min: xMin,
          max: xMax,
          time: {
            unit: "hour",
            displayFormats: { hour: "HH:mm", minute: "HH:mm", day: "MMM d" },
          },
          ticks: { maxTicksLimit: 13 },
        },
        y: { beginAtZero: true },
      },
    },
  });
}

// --- Main ---
async function refresh() {
  const data = await fetchReadings();
  updateSummaryCards(data);
  updateCharts(data);
}

function init() {
  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }

  const stored = getStoredRate();
  const rateInput = document.getElementById("rateInput");
  if (rateInput) {
    rateInput.value = stored != null ? stored : UK_AVERAGE_RATE;
  }

  rateInput?.addEventListener("input", refresh);
  rateInput?.addEventListener("change", refresh);
  document.getElementById("demoDataToggle")?.addEventListener("change", refresh);

  refresh();
}

init();
setInterval(refresh, 5000);
