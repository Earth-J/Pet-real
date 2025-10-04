const http = require('http');
const https = require('https');
const { URL } = require('url');

// สร้าง Agent แบบ keep-alive เพื่อ reuse connection ใต้โหลดสูง
const DEFAULT_MAX_SOCKETS = parseInt(process.env.HTTP_CLIENT_MAX_SOCKETS || '50');
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: DEFAULT_MAX_SOCKETS });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: DEFAULT_MAX_SOCKETS });

const DEFAULT_TIMEOUT_MS = parseInt(process.env.HTTP_CLIENT_TIMEOUT_MS || '15000');
const DEFAULT_RETRY = parseInt(process.env.HTTP_CLIENT_RETRY || '2');

function requestJson(method, urlString, body = undefined, headers = {}) {
  const attempt = (tryCount) => new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const payload = body ? Buffer.from(JSON.stringify(body)) : undefined;

      const options = {
        method,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          'Accept': 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
          ...headers,
        },
        agent: isHttps ? httpsAgent : httpAgent,
      };

      const req = lib.request(options, (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const text = buf.toString('utf8');
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            if (!text) return resolve(undefined);
            try {
              const json = JSON.parse(text);
              resolve(json);
            } catch (e) {
              // ไม่ใช่ JSON ก็คืน raw text
              resolve(text);
            }
          } else {
            let errMessage = `HTTP ${res.statusCode}`;
            try {
              const json = JSON.parse(text);
              errMessage += `: ${JSON.stringify(json)}`;
            } catch (_) {
              if (text) errMessage += `: ${text}`;
            }
            const err = new Error(errMessage);
            err.statusCode = res.statusCode;
            reject(err);
          }
        });
      });

      // timeout
      req.setTimeout(DEFAULT_TIMEOUT_MS, () => {
        req.destroy(new Error('HTTP_REQUEST_TIMEOUT'));
      });

      req.on('error', (err) => reject(err));

      if (payload) req.write(payload);
      req.end();
    } catch (err) {
      reject(err);
    }
  }).catch((err) => {
    if (tryCount < DEFAULT_RETRY) {
      // exponential backoff + jitter
      const delay = Math.min(1000 * Math.pow(2, tryCount), 4000) + Math.floor(Math.random() * 250);
      return new Promise((r) => setTimeout(r, delay)).then(() => attempt(tryCount + 1));
    }
    throw err;
  });

  return attempt(0);
}

function getJson(url, headers) {
  return requestJson('GET', url, undefined, headers);
}

function postJson(url, body, headers) {
  return requestJson('POST', url, body, headers);
}

module.exports = { requestJson, getJson, postJson }; 