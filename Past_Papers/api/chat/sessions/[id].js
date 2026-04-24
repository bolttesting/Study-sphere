const { supabaseAdmin } = require('../../_lib/supabase');
const { sendJson, requireAuth } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const id = req.query.id;
  const { data: session, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single();
  if (error || !session) return sendJson(res, 404, { error: 'Session not found' });

  if (req.method === 'GET') {
    const { data: messages } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });
    return sendJson(res, 200, { ...session, messages: messages || [] });
  }

  if (req.method === 'DELETE') {
    await supabaseAdmin.from('chat_messages').delete().eq('session_id', id);
    await supabaseAdmin.from('chat_sessions').delete().eq('id', id);
    return res.status(204).end();
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
