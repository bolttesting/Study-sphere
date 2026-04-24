const { supabaseAdmin } = require('../../_lib/supabase');
const { sendJson, requireAdmin } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') return sendJson(res, 405, { error: 'Method not allowed' });
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const id = req.query.id;
  const { admin_answer } = req.body || {};
  if (!admin_answer) return sendJson(res, 400, { error: 'Answer is required' });

  const { data, error } = await supabaseAdmin
    .from('student_queries')
    .update({
      admin_answer,
      status: 'resolved',
      resolved_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) return sendJson(res, 404, { error: error?.message || 'Query not found' });

  return sendJson(res, 200, {
    ...data,
    student: data.student_id,
  });
};
