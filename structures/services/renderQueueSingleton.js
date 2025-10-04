const { RenderQueueClient } = require('./renderQueue');

let singletonInstance = null;

function getRenderQueue() {
  if (!singletonInstance) {
    singletonInstance = new RenderQueueClient({
      baseUrl: (process.env.RENDER_SERVICE_URL || 'http://localhost:8081').replace(/\/$/, ''),
      apiKey: process.env.RENDER_SERVICE_KEY || undefined,
      pollIntervalMs: parseInt(process.env.RENDER_POLL_MS || '1200'),
      maxPollIntervalMs: parseInt(process.env.RENDER_POLL_MAX_MS || '5000'),
      timeoutMs: parseInt(process.env.RENDER_TIMEOUT_MS || '45000'),
    });
  }
  return singletonInstance;
}

module.exports = { getRenderQueue }; 