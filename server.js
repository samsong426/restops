const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/scheduling', require('./routes/scheduling'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/eod', require('./routes/eod'));
app.use('/api/menu', require('./routes/menu'));

app.get('/{*path}', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Restaurant Ops running at http://localhost:${PORT}`));
