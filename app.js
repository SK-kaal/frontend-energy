const API_URL = "http://localhost:5000/api/readings";
const STORAGE_RATE_KEY = "energy-monitor-rate-gbp-per-kwh";
const UK_AVERAGE_RATE = 0.2635;
const MAINS_VOLTS = 230;
const SIMULATED_DAYS = 31;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const CHANNEL = {
  ARDUINO: "arduino",
  KETTLE: "kettle",
  FRIDGE: "fridge",
  TV: "tv",
  WASHING: "washing",
};

const CHANNEL_ORDER = [
  CHANNEL.ARDUINO,
  CHANNEL.KETTLE,
  CHANNEL.FRIDGE,
  CHANNEL.TV,
  CHANNEL.WASHING,
];

let powerChart;
let currentChart;
let costChart;
let currentChannel = CHANNEL.ARDUINO;

// Deterministic pseudo-random 0..1
function noise(seed, i) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function toReading(timestampMs, powerWatts, meta = {}) {
  const p = Math.max(0, powerWatts);
  return {
    timestamp: new Date(timestampMs).toISOString(),
    current: Number((p / MAINS_VOLTS).toFixed(3)),
    powerWatts: Number(p.toFixed(2)),
    deviceId: meta.deviceId || "simulated",
    ...meta,
  };
}

// --- One month of hourly readings per simulated appliance (fixed window) ---
const HOURS_IN_MONTH = SIMULATED_DAYS * 24;
const SIM_MONTH_END = new Date("2025-03-31T23:00:00.000Z").getTime();
const SIM_MONTH_START = SIM_MONTH_END - (HOURS_IN_MONTH - 1) * HOUR_MS;

function buildMonthKettle() {
  const out = [];
  for (let i = 0; i < HOURS_IN_MONTH; i++) {
    const t = SIM_MONTH_START + i * HOUR_MS;
    const hour = i % 24;
    const day = Math.floor(i / 24);
    let w = 2 + noise(1, i) * 4;
    if ((hour === 7 || hour === 8) && day % 2 === 0) w = 2100 + noise(2, i) * 150;
    if ((hour === 18 || hour === 19) && day % 3 !== 1) w = Math.max(w, 2000 + noise(3, i) * 200);
    out.push(toReading(t, w, { appliance: CHANNEL.KETTLE }));
  }
  return out;
}

function buildMonthFridge() {
  const out = [];
  for (let i = 0; i < HOURS_IN_MONTH; i++) {
    const t = SIM_MONTH_START + i * HOUR_MS;
    const cycle = Math.sin((i % 6) / 6 * Math.PI * 2);
    const w = 55 + cycle * 35 + noise(4, i) * 12;
    out.push(toReading(t, w, { appliance: CHANNEL.FRIDGE }));
  }
  return out;
}

function buildMonthTv() {
  const out = [];
  for (let i = 0; i < HOURS_IN_MONTH; i++) {
    const t = SIM_MONTH_START + i * HOUR_MS;
    const hour = i % 24;
    let w = 6 + noise(5, i) * 4;
    if (hour >= 17 && hour <= 23) w = 95 + noise(6, i) * 45;
    if (hour >= 12 && hour <= 15 && (Math.floor(i / 24) % 7 === 5 || Math.floor(i / 24) % 7 === 6))
      w = Math.max(w, 110 + noise(7, i) * 30);
    out.push(toReading(t, w, { appliance: CHANNEL.TV }));
  }
  return out;
}

function buildMonthWashing() {
  const out = [];
  for (let i = 0; i < HOURS_IN_MONTH; i++) {
    const t = SIM_MONTH_START + i * HOUR_MS;
    const day = Math.floor(i / 24);
    const hour = i % 24;
    let w = 3 + noise(8, i) * 3;
    if (day % 3 === 0 && hour >= 10 && hour <= 12) w = 1750 + noise(9, i) * 120;
    if (day % 5 === 2 && hour >= 19 && hour <= 21) w = Math.max(w, 1850 + noise(10, i) * 100);
    out.push(toReading(t, w, { appliance: CHANNEL.WASHING }));
  }
  return out;
}

const SIMULATED_SERIES = {
  [CHANNEL.KETTLE]: buildMonthKettle(),
  [CHANNEL.FRIDGE]: buildMonthFridge(),
  [CHANNEL.TV]: buildMonthTv(),
  [CHANNEL.WASHING]: buildMonthWashing(),
};

// --- Offline Arduino fallback: 24h, 30-min samples (only when checkbox + API fails) ---
const ARDUINO_OFFLINE_DEMO = (() => {
  const baseDate = new Date("2025-03-22T00:00:00");
  const step = 30 * 60 * 1000;
  const powerByHour = [
    65, 60, 55, 70, 85, 120, 350, 420, 380, 2200, 2100, 180,
    150, 160, 500, 480, 450, 140, 120, 95, 320, 380, 110, 75,
  ];
  const readings = [];
  for (let i = 0; i < 48; i++) {
    const t = baseDate.getTime() + i * step;
    const hourIdx = Math.floor((i * 30) / 60) % 24;
    const p = powerByHour[hourIdx] + (Math.floor(i / 2) % 2 ? 20 : -15);
    readings.push(toReading(t, Math.max(0, p), { deviceId: "mkr1010_01", appliance: CHANNEL.ARDUINO }));
  }
  return readings;
})();

async function fetchArduinoReadings() {
  const useOfflineDemo = document.getElementById("arduinoDemoToggle")?.checked === true;

  if (useOfflineDemo) {
    return [...ARDUINO_OFFLINE_DEMO];
  }

  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    const cutoff = Date.now() - DAY_MS;
    return data.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
  } catch (error) {
    console.warn("API unavailable:", error.message);
    return [];
  }
}

function getReadingsForChannel(channel) {
  if (channel === CHANNEL.ARDUINO) return null;
  return SIMULATED_SERIES[channel] ? [...SIMULATED_SERIES[channel]] : [];
}

async function fetchReadings() {
  if (currentChannel === CHANNEL.ARDUINO) {
    return fetchArduinoReadings();
  }
  return Promise.resolve(getReadingsForChannel(currentChannel) || []);
}

// --- Cost ---
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

function getChartWindow(data, channel) {
  const timestamps = data.map((item) => new Date(item.timestamp).getTime());
  const minT = Math.min(...timestamps);
  const maxT = Math.max(...timestamps);
  if (channel === CHANNEL.ARDUINO) {
    return {
      xMin: maxT - DAY_MS,
      xMax: maxT,
      timeUnit: "hour",
      maxTicks: 13,
    };
  }
  return {
    xMin: minT,
    xMax: maxT,
    timeUnit: "day",
    maxTicks: 12,
  };
}

function updateSummaryCards(data) {
  const banner = document.getElementById("sourceBanner");
  if (banner) {
    if (currentChannel === CHANNEL.ARDUINO) {
      const offline = document.getElementById("arduinoDemoToggle")?.checked;
      banner.textContent = offline
        ? "Arduino view: simulated 24h stand-in (toggle off to use live API when available)."
        : "Arduino view: live data from your device (last 24 hours).";
    } else {
      const n = SIMULATED_DAYS;
      banner.textContent = `Simulated appliance: ${n} days of hourly historical data (not from your sensor).`;
    }
  }

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

function applyChartScales(chart, win) {
  if (!chart?.options?.scales?.x) return;
  chart.options.scales.x.min = win.xMin;
  chart.options.scales.x.max = win.xMax;
  chart.options.scales.x.time.unit = win.timeUnit;
  chart.options.scales.x.ticks.maxTicksLimit = win.maxTicks;
}

function updateCharts(data) {
  if (!data || data.length === 0) {
    if (powerChart) powerChart.destroy();
    if (currentChart) currentChart.destroy();
    if (costChart) costChart.destroy();
    powerChart = currentChart = costChart = null;
    return;
  }

  const win = getChartWindow(data, currentChannel);
  const timestamps = data.map((item) => new Date(item.timestamp).getTime());
  const currentValues = data.map((item) => Number(item.current));
  const powerValues = data.map((item) => Number(item.powerWatts));
  const rate = getRate();
  const costValues =
    rate != null && rate > 0
      ? calculateCumulativeCosts(data, rate)
      : data.map((item) => Number(item.estimatedCost || 0));

  const costLabel = rate != null ? "Cumulative cost (£)" : "Estimated cost (£)";

  if (powerChart) {
    powerChart.data.datasets[0].data = timestamps.map((t, i) => ({ x: t, y: powerValues[i] }));
    applyChartScales(powerChart, win);
    powerChart.update("none");
  } else {
    powerChart = createChart("powerChart", "Power (W)", timestamps, powerValues, win);
  }

  if (currentChart) {
    currentChart.data.datasets[0].data = timestamps.map((t, i) => ({ x: t, y: currentValues[i] }));
    applyChartScales(currentChart, win);
    currentChart.update("none");
  } else {
    currentChart = createChart("currentChart", "Current (A)", timestamps, currentValues, win);
  }

  if (costChart) {
    costChart.data.datasets[0].data = timestamps.map((t, i) => ({ x: t, y: costValues[i] }));
    costChart.data.datasets[0].label = costLabel;
    applyChartScales(costChart, win);
    costChart.update("none");
  } else {
    costChart = createChart("costChart", costLabel, timestamps, costValues, win);
  }
}

function createChart(canvasId, label, timestamps, values, win) {
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
          tension: 0.15,
          pointRadius: 0,
          pointHitRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          type: "time",
          min: win.xMin,
          max: win.xMax,
          time: {
            unit: win.timeUnit,
            displayFormats: { hour: "HH:mm", day: "d MMM" },
          },
          ticks: { maxTicksLimit: win.maxTicks },
        },
        y: { beginAtZero: true },
      },
    },
  });
}

async function refresh() {
  const data = await fetchReadings();
  updateSummaryCards(data);
  updateCharts(data);
}

function setActiveNav() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.channel === currentChannel);
  });
}

function initNav() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      currentChannel = link.dataset.channel;
      history.replaceState(null, "", `#${currentChannel}`);
      setActiveNav();
      const arduinoRow = document.getElementById("arduinoOnlyControls");
      if (arduinoRow) {
        arduinoRow.hidden = currentChannel !== CHANNEL.ARDUINO;
      }
      if (powerChart) {
        powerChart.destroy();
        if (currentChart) currentChart.destroy();
        if (costChart) costChart.destroy();
        powerChart = currentChart = costChart = null;
      }
      refresh();
    });
  });

  const hash = (location.hash || "#arduino").slice(1).toLowerCase();
  if (CHANNEL_ORDER.includes(hash)) {
    currentChannel = hash;
  }
  setActiveNav();
  const arduinoRow = document.getElementById("arduinoOnlyControls");
  if (arduinoRow) arduinoRow.hidden = currentChannel !== CHANNEL.ARDUINO;
}

function init() {
  initNav();

  const stored = getStoredRate();
  const rateInput = document.getElementById("rateInput");
  if (rateInput) {
    rateInput.value = stored != null ? stored : UK_AVERAGE_RATE;
  }

  rateInput?.addEventListener("input", refresh);
  rateInput?.addEventListener("change", refresh);
  document.getElementById("arduinoDemoToggle")?.addEventListener("change", refresh);

  refresh();
}

init();
setInterval(() => {
  if (currentChannel === CHANNEL.ARDUINO) refresh();
}, 5000);
