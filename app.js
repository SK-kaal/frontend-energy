const API_URL = "http://localhost:5000/api/readings";

let powerChart;
let currentChart;
let costChart;

async function fetchReadings() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.log("No readings found");
      return;
    }

    updateSummaryCards(data);
    updateCharts(data);
  } catch (error) {
    console.error("Failed to fetch readings:", error);
  }
}

function updateSummaryCards(data) {
  const latest = data[data.length - 1];

  document.getElementById("latestCurrent").textContent =
    `${Number(latest.current).toFixed(2)} A`;

  document.getElementById("latestPower").textContent =
    `${Number(latest.powerWatts).toFixed(2)} W`;

  document.getElementById("latestCost").textContent =
    `£${Number(latest.estimatedCost).toFixed(4)}`;
}

function updateCharts(data) {
  const labels = data.map(item =>
    new Date(item.timestamp).toLocaleTimeString()
  );

  const currentValues = data.map(item => Number(item.current));
  const powerValues = data.map(item => Number(item.powerWatts));
  const costValues = data.map(item => Number(item.estimatedCost));

  if (powerChart) powerChart.destroy();
  if (currentChart) currentChart.destroy();
  if (costChart) costChart.destroy();

  powerChart = createChart("powerChart", "Power (W)", labels, powerValues);
  currentChart = createChart("currentChart", "Current (A)", labels, currentValues);
  costChart = createChart("costChart", "Estimated Cost (£)", labels, costValues);
}

function createChart(canvasId, label, labels, values) {
  const ctx = document.getElementById(canvasId).getContext("2d");

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: label,
          data: values,
          borderWidth: 2,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

fetchReadings();
setInterval(fetchReadings, 5000);