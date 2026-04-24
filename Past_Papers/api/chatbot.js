const { supabaseAdmin } = require('./_lib/supabase');
const { sendJson, requireAuth } = require('./_lib/auth');
const { askGroq } = require('./_lib/llm');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { message, mode = 'GENERAL', selected_note_ids = [], session_id = null } = req.body || {};
  if (!message?.trim()) return sendJson(res, 400, { error: 'Message is required' });

  let session = null;
  if (session_id) {
    const { data } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', auth.user.id)
      .single();
    session = data;
  }
  if (!session) {
    const { data } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        user_id: auth.user.id,
        mode,
        title: message.slice(0, 80),
      })
      .select('*')
      .single();
    session = data;
  }

  await supabaseAdmin.from('chat_messages').insert({
    session_id: session.id,
    role: 'user',
    content: message,
  });

  let contextBlock = '';
  if (mode === 'RAG' && selected_note_ids.length) {
    const { data: notes } = await supabaseAdmin.from('notes').select('title,subject,class_name').in('id', selected_note_ids);
    contextBlock = `Selected notes:\n${(notes || []).map((n) => `- ${n.title} (${n.subject}, ${n.class_name})`).join('\n')}`;
  }

  const prompt = `${contextBlock}\n\nStudent question:\n${message}\n\nAnswer in a concise study-friendly way.`;
  let reply = await askGroq(prompt);
  let unanswered = false;
  if (!reply) {
    reply = 'I could not confidently answer that right now. You can submit this query for admin review.';
    unanswered = true;
  }

  await supabaseAdmin.from('chat_messages').insert({
    session_id: session.id,
    role: 'assistant',
    content: reply,
  });
  await supabaseAdmin.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', session.id);

  return sendJson(res, 200, {
    session_id: session.id,
    reply,
    sources: [],
    unanswered,
  });
};
