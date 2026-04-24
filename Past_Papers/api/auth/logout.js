const { sendJson } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  return sendJson(res, 200, { ok: true });
};
