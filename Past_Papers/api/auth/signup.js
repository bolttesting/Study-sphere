const { supabaseAdmin, supabasePublic } = require('../_lib/supabase');
const { sendJson } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const { email, password, firstName, lastName, role, class_name } = req.body || {};
    if (!email || !password || !firstName || !lastName || !role) {
      return sendJson(res, 400, { error: 'Missing required fields' });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { firstName, lastName },
    });
    if (createError || !created?.user) return sendJson(res, 400, { error: createError?.message || 'Signup failed' });

    const profilePayload = {
      id: created.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      class_name: role === 'Student' ? class_name || null : null,
    };
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(profilePayload);
    if (profileError) return sendJson(res, 400, { error: profileError.message });

    const { data: signInData, error: signInError } = await supabasePublic.auth.signInWithPassword({ email, password });
    if (signInError || !signInData?.session) return sendJson(res, 400, { error: signInError?.message || 'Auto login failed' });

    return sendJson(res, 201, {
      access: signInData.session.access_token,
      refresh: signInData.session.refresh_token,
      user: {
        email,
        firstName,
        lastName,
        role,
        class_name: profilePayload.class_name,
      },
    });
  } catch (e) {
    return sendJson(res, 500, { error: 'Internal server error' });
  }
};
