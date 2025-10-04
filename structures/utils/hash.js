const crypto = require('crypto');

function stableHash(obj) {
  const str = JSON.stringify(obj);
  return crypto.createHash('sha1').update(str).digest('hex');
}

module.exports = { stableHash }; 