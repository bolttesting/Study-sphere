const { supabasePublic, supabaseAdmin } = require('./supabase');

function sendJson(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

async function getUserFromRequest(req) {
  const token = getBearerToken(req);
  if (!token) return { user: null, error: 'Missing token' };
  const { data, error } = await supabasePublic.auth.getUser(token);
  if (error || !data?.user) return { user: null, error: error?.message || 'Invalid token' };
  return { user: data.user, error: null };
}

async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

async function requireAuth(req, res) {
  const { user, error } = await getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: error || 'Unauthorized' });
    return null;
  }
  const profile = await getProfile(user.id);
  return { user, profile };
}

async function requireAdmin(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return null;
  if (!auth.profile || auth.profile.role !== 'Admin') {
    sendJson(res, 403, { error: 'Admin access required.' });
    return null;
  }
  return auth;
}

module.exports = { sendJson, getBearerToken, getUserFromRequest, requireAuth, requireAdmin };
