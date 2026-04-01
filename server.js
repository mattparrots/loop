const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'chores.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { chores: [] };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sortChores(chores) {
  return chores.slice().sort((a, b) => {
    // null lastDone (never done) sorts first
    if (!a.lastDone && !b.lastDone) return new Date(a.createdAt) - new Date(b.createdAt);
    if (!a.lastDone) return -1;
    if (!b.lastDone) return 1;
    return new Date(a.lastDone) - new Date(b.lastDone);
  });
}

// GET /api/chores
app.get('/api/chores', (req, res) => {
  const data = readData();
  res.json({ chores: sortChores(data.chores) });
});

// POST /api/chores
app.post('/api/chores', (req, res) => {
  const { name, urgencyHours } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ error: 'name must be 100 characters or fewer' });
  }
  const hrs = urgencyHours !== undefined ? Number(urgencyHours) : 72;
  if (isNaN(hrs) || hrs < 1 || hrs > 8760) {
    return res.status(400).json({ error: 'urgencyHours must be between 1 and 8760' });
  }

  const data = readData();
  const chore = {
    id: crypto.randomBytes(4).toString('hex'),
    name: name.trim(),
    lastDone: null,
    createdAt: new Date().toISOString(),
    urgencyHours: hrs,
    history: [],
  };
  data.chores.push(chore);
  writeData(data);
  res.status(201).json({ chore });
});

// POST /api/chores/:id/done
app.post('/api/chores/:id/done', (req, res) => {
  const data = readData();
  const chore = data.chores.find(c => c.id === req.params.id);
  if (!chore) return res.status(404).json({ error: 'chore not found' });

  const now = new Date().toISOString();
  chore.history.unshift(now);
  if (chore.history.length > 365) chore.history = chore.history.slice(0, 365);
  chore.lastDone = now;
  writeData(data);
  res.json({ chore });
});

// DELETE /api/chores/:id
app.delete('/api/chores/:id', (req, res) => {
  const data = readData();
  const idx = data.chores.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'chore not found' });

  data.chores.splice(idx, 1);
  writeData(data);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Chore tracker running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
