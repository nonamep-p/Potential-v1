import express from 'express';
import { config } from './config.js';

export function startKeepAlive() {
  const app = express();
  
  // Health check endpoint
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'alive',
      bot: 'Plagg Bot',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });
  
  // Stats endpoint
  app.get('/stats', (req, res) => {
    res.status(200).json({
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform,
    });
  });
  
  app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`🌐 Keep-alive server running on port ${config.PORT}`);
  });
}
