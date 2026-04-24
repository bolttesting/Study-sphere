const { supabaseAdmin } = require('../_lib/supabase');
const { sendJson, requireAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;

  let query = supabaseAdmin.from('student_queries').select('*').order('created_at', { ascending: false });
  if (auth.profile?.role !== 'Admin') {
    query = query.eq('student_id', auth.user.id);
  } else if (req.query.status) {
    query = query.eq('status', req.query.status);
  }

  const { data, error } = await query;
  if (error) return sendJson(res, 400, { error: error.message });
  const rows = data || [];
  const ids = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
  let profileMap = {};
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id,first_name,last_name').in('id', ids);
    (profiles || []).forEach((p) => {
      profileMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    });
  }

  return sendJson(res, 200, rows.map((r) => ({
    ...r,
    student: r.student_id,
    student_name: profileMap[r.student_id] || 'Student',
  })));
};
