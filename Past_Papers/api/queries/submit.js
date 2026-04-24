const { supabaseAdmin } = require('../_lib/supabase');
const { sendJson, requireAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { question, student_email } = req.body || {};
  if (!question) return sendJson(res, 400, { error: 'Question is required' });

  const payload = {
    student_id: auth.user.id,
    student_email: student_email || auth.user.email,
    class_name: auth.profile?.class_name || null,
    question,
    status: 'pending',
  };
  const { data, error } = await supabaseAdmin.from('student_queries').insert(payload).select('*').single();
  if (error) return sendJson(res, 400, { error: error.message });
  return sendJson(res, 201, {
    ...data,
    student: data.student_id,
    student_name: `${auth.profile?.first_name || ''} ${auth.profile?.last_name || ''}`.trim() || 'Student',
  });
};
