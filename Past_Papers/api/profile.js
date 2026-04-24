const { supabaseAdmin } = require('./_lib/supabase');
const { sendJson, requireAuth } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const userId = auth.user.id;

  if (req.method === 'GET') {
    return sendJson(res, 200, {
      user: {
        email: auth.profile?.email || auth.user.email,
        firstName: auth.profile?.first_name || '',
        lastName: auth.profile?.last_name || '',
        role: auth.profile?.role || 'Student',
        class_name: auth.profile?.class_name || null,
      },
    });
  }

  if (req.method === 'PATCH') {
    const { firstName, lastName, class_name, password } = req.body || {};
    const updates = {};
    if (typeof firstName === 'string') updates.first_name = firstName;
    if (typeof lastName === 'string') updates.last_name = lastName;
    if (typeof class_name === 'string') updates.class_name = class_name || null;
    if (Object.keys(updates).length) {
      updates.updated_at = new Date().toISOString();
      const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
      if (error) return sendJson(res, 400, { error: error.message });
    }

    if (password) {
      const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (pwdError) return sendJson(res, 400, { error: pwdError.message });
    }

    const { data: profile, error } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
    if (error) return sendJson(res, 400, { error: error.message });

    return sendJson(res, 200, {
      user: {
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: profile.role,
        class_name: profile.class_name,
      },
    });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
