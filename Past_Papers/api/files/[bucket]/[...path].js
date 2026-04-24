const { supabaseAdmin } = require('../../_lib/supabase');
const { requireAuth } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const bucket = req.query.bucket;
  const rawPath = req.query.path;
  const path = Array.isArray(rawPath) ? rawPath.join('/') : rawPath;
  if (!bucket || !path) return res.status(400).json({ error: 'Missing file path' });

  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error || !data) return res.status(404).json({ error: 'File not found' });

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  res.setHeader('Content-Type', data.type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename=\"${path.split('/').pop()}\"`);
  return res.status(200).end(buffer);
};
