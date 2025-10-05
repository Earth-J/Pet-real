const { postJson, getJson } = require('./httpClient');

class RenderQueueClient {
  constructor(options) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.pollIntervalMs = options.pollIntervalMs || 2000;
    this.maxPollIntervalMs = options.maxPollIntervalMs || 5000;
    this.timeoutMs = options.timeoutMs || 30000;
    this.apiKey = options.apiKey || undefined;
  }
 async healthCheck() {
    const url = `${this.baseUrl}/health`;
    const headers = this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : undefined;
    return await getJson(url, headers);
  }
  
  async enqueue(jobPayload) {
    const url = `${this.baseUrl}/jobs`;
    const headers = this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : undefined;
    const res = await postJson(url, jobPayload, headers);
    return res; // { jobId }
  }

  async getStatus(jobId) {
    const url = `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`;
    const headers = this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : undefined;
    const res = await getJson(url, headers);
    return res; // { status, url?, error?, format? }
  }

  async waitForResult(jobId) {
    const startedAt = Date.now();
    let currentInterval = this.pollIntervalMs;
    while (true) {
      if (Date.now() - startedAt > this.timeoutMs) {
        const err = new Error('Render job timeout');
        err.code = 'RENDER_TIMEOUT';
        throw err;
      }
      const status = await this.getStatus(jobId);
      if (status.status === 'done' && status.url) return status;
      if (status.status === 'error') {
        const err = new Error(status.error || 'Render job failed');
        err.code = 'RENDER_FAILED';
        throw err;
      }
      // backoff + jitter
      const jitter = Math.floor(Math.random() * Math.floor(currentInterval * 0.2));
      await new Promise(r => setTimeout(r, currentInterval + jitter));
      currentInterval = Math.min(currentInterval * 1.5, this.maxPollIntervalMs);
    }
  }
}

module.exports = { RenderQueueClient }; 
