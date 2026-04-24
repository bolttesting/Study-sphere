const { supabaseAdmin } = require('../../_lib/supabase');
const { sendJson, requireAuth } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('updated_at', { ascending: false });
    if (error) return sendJson(res, 400, { error: error.message });

    const ids = (data || []).map((s) => s.id);
    let lastMap = {};
    if (ids.length) {
      const { data: msgs } = await supabaseAdmin
        .from('chat_messages')
        .select('*')
        .in('session_id', ids)
        .order('created_at', { ascending: false });
      (msgs || []).forEach((m) => {
        if (!lastMap[m.session_id]) lastMap[m.session_id] = m;
      });
    }

    return sendJson(res, 200, (data || []).map((s) => ({
      id: s.id,
      title: s.title,
      mode: s.mode,
      created_at: s.created_at,
      updated_at: s.updated_at,
      last_message: lastMap[s.id]?.content?.slice(0, 80) || '',
      message_count: 0,
    })));
  }

  if (req.method === 'POST') {
    const { title = 'New Chat', mode = 'GENERAL' } = req.body || {};
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert({ user_id: auth.user.id, title, mode })
      .select('*')
      .single();
    if (error) return sendJson(res, 400, { error: error.message });
    return sendJson(res, 201, data);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
