# Energy Monitoring Dashboard

A web dashboard for energy readings from an **Arduino MKR WiFi 1010** (via **MongoDB Atlas** backend) and **simulated** household appliances for comparison and demos.

## Features

- **Arduino (live)** — Reads `GET /api/readings`; shows the last **24 hours** of data from your physical sensor. Optional checkbox: **simulate Arduino (24h)** when the API is offline (does not auto-replace real data unless you opt in).
- **Simulated appliances** — **Kettle**, **Fridge**, **TV**, **Washing machine**: each has **31 days** of **hourly** synthetic power data (deterministic, precomputed in the browser). These are **not** from your Arduino.
- **Summary cards** — Latest current (A), power (W), and cost per hour (£/hr) for the selected source.
- **£/kWh** — Default UK average (~£0.2635); your value is saved in the browser.
- **Charts** — Power, current, and cumulative cost over time. Arduino view uses an hourly time axis for one day; simulated views span the full month on a day-based axis.

## Tech Stack

- Vanilla HTML, CSS, and JavaScript
- [Chart.js](https://www.chartjs.org/) + [chartjs-adapter-date-fns](https://github.com/chartjs/chartjs-adapter-date-fns) for time scales

## Project Structure

```
frontend/
├── index.html
├── style.css
├── app.js
├── README.md
└── energy-monitor-single-vs-multiple-appliances.txt
```

## Prerequisites

- Backend at `http://localhost:5000` with `GET /api/readings` returning objects with at least `current`, `powerWatts`, `timestamp`.

## Running

```bash
npx serve .
```

Open the URL shown (e.g. `http://localhost:3000`). Use the top nav to switch between **Arduino (live)** and each simulated appliance.

## Configuration

Change the API URL in `app.js`:

```javascript
const API_URL = "http://localhost:5000/api/readings";
```

## License

MIT
