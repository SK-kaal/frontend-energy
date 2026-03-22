# Energy Monitoring Dashboard

A real-time web dashboard for visualizing energy consumption data collected from an **Arduino MKR WiFi 1010** and stored in **MongoDB Atlas**.

## Features

- **Live summary cards** — Latest current (A), power (W), and estimated cost (£)
- **Interactive charts** — Power usage, current, and cost over time
- **Auto-refresh** — Data updates every 5 seconds
- **Responsive layout** — Works on desktop and mobile devices

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
  - `estimatedCost` — Estimated cost in pounds (£)
  - `timestamp` — ISO timestamp string

## Running the Dashboard

1. Ensure your backend API is running on port 5000.
2. Open `index.html` in a web browser, or serve the folder with a local server:

   ```bash
   npx serve .
   # or
   python -m http.server 8000
   ```

3. If using a local server, open `http://localhost:8000` (or the port you chose).

## Configuration

To change the API endpoint, edit `API_URL` in `app.js`:

```javascript
const API_URL = "http://localhost:5000/api/readings";
```

## License

MIT
