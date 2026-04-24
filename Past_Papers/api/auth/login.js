const { supabasePublic } = require('../_lib/supabase');
const { sendJson } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) return sendJson(res, 400, { error: 'Email and password required' });

    const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });
    if (error || !data?.session || !data?.user) return sendJson(res, 401, { error: error?.message || 'Invalid credentials' });

    const { data: profile } = await supabasePublic
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return sendJson(res, 200, {
      access: data.session.access_token,
      refresh: data.session.refresh_token,
      user: {
        email: data.user.email,
        firstName: profile?.first_name || '',
        lastName: profile?.last_name || '',
        role: profile?.role || 'Student',
        class_name: profile?.class_name || null,
      },
    });
  } catch (e) {
    return sendJson(res, 500, { error: 'Internal server error' });
  }
};
