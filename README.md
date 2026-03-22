# Energy Monitoring Dashboard

A real-time web dashboard for visualizing energy consumption data collected from an **Arduino MKR WiFi 1010** and stored in **MongoDB Atlas**.

## Features

- **Live summary cards** — Latest current (A), power (W), and cost per hour (£/hr)
- **Custom cost rate** — Enter your £/kWh to calculate cost in real time (saved in browser)
- **Single circuit view** — Shows total power draw from one Arduino sensor (no per-appliance breakdown)
- **Interactive charts** — Power usage, current, and cumulative cost over time
- **Auto-refresh** — Data updates every 5 seconds
- **Demo mode** — Use fake data when the backend is unavailable (checkbox in header)

## Tech Stack

- Vanilla HTML, CSS, and JavaScript
- [Chart.js](https://www.chartjs.org/) for data visualization
- Fetches data from a local backend API

## Project Structure

```
frontend/
├── index.html   # Dashboard layout and structure
├── style.css    # Styling and responsive design
├── app.js       # API integration and chart logic
└── README.md    # This file
```

## Prerequisites

- A backend API running at `http://localhost:5000` that serves energy readings
- The API should expose `GET /api/readings` returning a JSON array of objects with:
  - `current` — Current in amps (A)
  - `powerWatts` — Power in watts (W)
  - `timestamp` — ISO timestamp string
  - `deviceId` — (optional) Device identifier, e.g. `mkr1010_01`
  - `estimatedCost` — (optional) Backend cost; overridden by frontend when £/kWh is set

## Running the Dashboard

1. Ensure your backend API is running on port 5000.
2. Open `index.html` in a web browser, or serve the folder with a local server:

   ```bash
   npx serve .
   # or
   python -m http.server 8000
   ```

3. If using a local server, open `http://localhost:8000` (or the port you chose).

## Demo Data (No Backend Required)

You can run and test the dashboard **without a backend**:

1. Check **"Use demo data"** in the header.
2. The app will generate realistic mock readings for a single circuit (varying power over time).

If the backend API is unreachable, the app **automatically falls back** to demo data and logs a warning in the console.

## Configuration

To change the API endpoint, edit `API_URL` in `app.js`:

```javascript
const API_URL = "http://localhost:5000/api/readings";
```

## License

MIT
