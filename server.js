import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// In-memory live parking state for Northflank cloud deployment
let latestParkingState = {
  slots: [
    { id: 1, name: 'Slot 1', status: 'EMPTY', distance: 25.0, unit: 'cm', updatedAt: new Date().toISOString() },
    { id: 2, name: 'Slot 2', status: 'EMPTY', distance: 25.0, unit: 'cm', updatedAt: new Date().toISOString() },
    { id: 3, name: 'Slot 3', status: 'EMPTY', distance: 25.0, unit: 'cm', updatedAt: new Date().toISOString() },
  ],
  gate: 'OPEN',
  gateAngle: 0,
  buzzerOn: false,
  totalOccupied: 0,
  totalSlots: 3,
  lastUpdated: Date.now(),
  source: 'initial',
};

// Health check endpoint for Northflank / container orchestrators
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// API: Get latest live parking state for QR code scanners & public viewers
app.get('/api/parking/state', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(latestParkingState);
});

// API: Broadcast live parking state from gateway device (connected phone/Arduino)
app.post('/api/parking/state', (req, res) => {
  if (req.body && req.body.slots) {
    latestParkingState = {
      ...req.body,
      lastUpdated: Date.now(),
    };
    return res.status(200).json({ ok: true, lastUpdated: latestParkingState.lastUpdated });
  }
  res.status(400).json({ error: 'Invalid parking state' });
});

// Serve static assets from Vite build output (dist/)
app.use(
  express.static(path.join(__dirname, 'dist'), {
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      // HTML and manifest should not be cached aggressively to allow instant updates
      if (filePath.endsWith('.html') || filePath.endsWith('.webmanifest')) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
    },
  })
);

// SPA fallback: any unknown route serves index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Smart Parking Web App running on port ${PORT}`);
});
