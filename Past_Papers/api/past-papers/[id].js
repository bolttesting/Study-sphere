const path = require('path');
const { supabaseAdmin } = require('../_lib/supabase');
const { sendJson, requireAdmin } = require('../_lib/auth');
const { parseForm, getField, getFile, readTempFile } = require('../_lib/multipart');

module.exports = async function handler(req, res) {
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const id = req.query.id;
  const { data: existing } = await supabaseAdmin.from('past_papers').select('*').eq('id', id).single();
  if (!existing) return sendJson(res, 404, { error: 'Past paper not found' });

  if (req.method === 'DELETE') {
    if (existing.file_path) await supabaseAdmin.storage.from('past-papers').remove([existing.file_path]);
    const { error } = await supabaseAdmin.from('past_papers').delete().eq('id', id);
    if (error) return sendJson(res, 400, { error: error.message });
    return res.status(204).end();
  }

  if (req.method !== 'PUT') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const { fields, files } = await parseForm(req);
    const title = getField(fields, 'title') || existing.title;
    const subject = getField(fields, 'subject') || existing.subject;
    const class_name = getField(fields, 'class_name') || existing.class_name;
    const year = getField(fields, 'year') || existing.year;
    const exam_type = getField(fields, 'exam_type') || existing.exam_type;
    const file = getFile(files, 'file');
    let file_path = existing.file_path;

    if (file) {
      const ext = path.extname(file.originalFilename || '.pdf');
      file_path = `${auth.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      const buffer = await readTempFile(file);
      const { error: uploadErr } = await supabaseAdmin.storage.from('past-papers').upload(file_path, buffer, {
        contentType: file.mimetype || 'application/pdf',
        upsert: false,
      });
      if (uploadErr) return sendJson(res, 400, { error: uploadErr.message });
      if (existing.file_path) await supabaseAdmin.storage.from('past-papers').remove([existing.file_path]);
    }

    const { data, error } = await supabaseAdmin
      .from('past_papers')
      .update({ title, subject, class_name, year, exam_type, file_path, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return sendJson(res, 400, { error: error.message });
    return sendJson(res, 200, {
      id: data.id,
      title: data.title,
      subject: data.subject,
      class_name: data.class_name,
      year: data.year,
      exam_type: data.exam_type,
      file: `/api/files/past-papers/${encodeURIComponent(data.file_path)}`,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  } catch (e) {
    return sendJson(res, 500, { error: 'Update failed' });
  }
};

module.exports.config = { api: { bodyParser: false } };
