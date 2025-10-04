const http = require('http');
const https = require('https');
const { URL } = require('url');
const { AttachmentBuilder } = require('discord.js');

const MAX_DOWNLOAD_BYTES = parseInt(process.env.RENDER_MAX_IMAGE_BYTES || '10485760'); // 10MB
const DOWNLOAD_TIMEOUT_MS = parseInt(process.env.RENDER_DOWNLOAD_TIMEOUT_MS || '15000');

const HTTP_MAX_SOCKETS = parseInt(process.env.HTTP_CLIENT_MAX_SOCKETS || '50');
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: HTTP_MAX_SOCKETS });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: HTTP_MAX_SOCKETS });

function fetchBuffer(urlString) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(urlString);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;
      const options = {
        method: 'GET',
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        agent: isHttps ? httpsAgent : httpAgent,
      };
      const req = lib.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          req.destroy();
          return reject(new Error(`HTTP ${res.statusCode} for ${urlString}`));
        }
        const chunks = [];
        let total = 0;
        res.on('data', (d) => {
          total += d.length;
          if (total > MAX_DOWNLOAD_BYTES) {
            req.destroy(new Error('DOWNLOAD_TOO_LARGE'));
            return;
          }
          chunks.push(d);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
        req.destroy(new Error('DOWNLOAD_TIMEOUT'));
      });
      req.on('error', reject);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

function isLocalServiceUrl(url, baseUrl) {
  try
  {
    const input = new URL(url);
    const base = new URL(baseUrl);
    return input.hostname === base.hostname && input.port === base.port;
  }
  catch (_) {
    return false;
  }
}

async function uploadFromUrlToDiscordMessage(msg, url, filename = 'house.png') {
  const buf = await fetchBuffer(url);
  const att = new AttachmentBuilder(buf, { name: filename });
  const message = await msg.edit({ files: [att] });
  const uploaded = message.attachments.first();
  return uploaded ? uploaded.url : null;
}

async function uploadFromUrlToInteraction(interaction, url, filename = 'house.png') {
  const buf = await fetchBuffer(url);
  const att = new AttachmentBuilder(buf, { name: filename });
  await interaction.editReply({ files: [att] });
  const message = await interaction.fetchReply();
  const uploaded = message.attachments.first();
  return uploaded ? uploaded.url : null;
}

module.exports = { fetchBuffer, isLocalServiceUrl, uploadFromUrlToDiscordMessage, uploadFromUrlToInteraction }; 