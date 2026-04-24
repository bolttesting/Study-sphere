const { supabaseAdmin } = require('../_lib/supabase');
const { sendJson, requireAuth } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const { class_name, subject } = req.query || {};
  let query = supabaseAdmin.from('notes').select('*').order('created_at', { ascending: false });
  if (auth.profile?.role !== 'Admin' && auth.profile?.class_name) query = query.eq('class_name', auth.profile.class_name);
  if (class_name) query = query.eq('class_name', class_name);
  if (subject) query = query.eq('subject', subject);

  const { data, error } = await query;
  if (error) return sendJson(res, 400, { error: error.message });

  const rows = (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    subject: row.subject,
    class_name: row.class_name,
    file: `/api/files/notes/${encodeURIComponent(row.file_path)}`,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return sendJson(res, 200, rows);
};
