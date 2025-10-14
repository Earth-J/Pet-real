// Improved rate-limit handler: log details and apply small backoff with jitter
module.exports = async (client, info) => {
    try {
        const route = info && (info.route || info.path || 'unknown');
        const limit = info && info.limit ? String(info.limit) : 'unknown';
        const timeoutMs = info && info.timeout ? Number(info.timeout) : 0;
        const global = info && Boolean(info.global);
        console.warn(`[WARN] Rate Limited: route=${route} limit=${limit} global=${global} timeoutMs=${timeoutMs}`);

        // Minimal backoff to reduce pressure; Discord.js will also handle internally
        const jitter = Math.floor(Math.random() * 250);
        const delay = Math.max(timeoutMs || 1000, 1000) + jitter;
        await new Promise(r => setTimeout(r, delay));
    } catch (_) {
        // no-op
    }
}