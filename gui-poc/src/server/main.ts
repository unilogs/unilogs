import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;

// Middleware
app.use(express.json());

// API Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Example API route
app.get('/api/example', (_req, res) => {
  res.json({ message: 'Hello from the API!' });
});

app.get('/api/stop', (_req, res) => {
  console.log('Stopping server...');
  res.json({ message: 'Server is stopping...' });
  server.close(() => process.exit(0));
});

// Serve static files in production
if (config.isProduction) {
  const clientBuildPath = path.join(__dirname, '../../dist');
  
  // Serve static files from the React app
  app.use(express.static(clientBuildPath, { index: false }));
  
  // Handle React routing, return all other GET requests to React app
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile('index.html', { root: clientBuildPath });
  });
}

// Function to open browser
const openBrowser = async (url: string) => {
    try {
      const { default: open } = await import('open');
      await open(url);
    } catch (error) {
      console.error('Failed to open browser:', error);
    }
};

// Start the server
const server = app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server is running in ${config.nodeEnv} mode on ${url}`);
  console.log('API endpoints:');
  console.log(`- GET ${url}/api/health`);
  console.log(`- GET ${url}/api/example`);
  
  // Open the URL in the default browser (non-blocking)
  console.log('Opening browser...');
  void openBrowser(url);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

export default app;
