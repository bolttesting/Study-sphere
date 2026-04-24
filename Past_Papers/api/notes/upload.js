const path = require('path');
const { supabaseAdmin } = require('../_lib/supabase');
const { sendJson, requireAdmin } = require('../_lib/auth');
const { parseForm, getField, getFile, readTempFile } = require('../_lib/multipart');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const { fields, files } = await parseForm(req);
    const title = getField(fields, 'title');
    const subject = getField(fields, 'subject');
    const class_name = getField(fields, 'class_name');
    const file = getFile(files, 'file');

    if (!title || !subject || !class_name || !file) return sendJson(res, 400, { error: 'Missing required fields' });

    const ext = path.extname(file.originalFilename || '.pdf');
    const storagePath = `${auth.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const buffer = await readTempFile(file);

    const { error: uploadErr } = await supabaseAdmin.storage.from('notes').upload(storagePath, buffer, {
      contentType: file.mimetype || 'application/pdf',
      upsert: false,
    });
    if (uploadErr) return sendJson(res, 400, { error: uploadErr.message });

    const { data, error } = await supabaseAdmin
      .from('notes')
      .insert({
        title, subject, class_name,
        file_path: storagePath,
        uploaded_by: auth.user.id,
      })
      .select('*')
      .single();
    if (error) return sendJson(res, 400, { error: error.message });

    return sendJson(res, 201, {
      id: data.id,
      title: data.title,
      subject: data.subject,
      class_name: data.class_name,
      file: `/api/files/notes/${encodeURIComponent(data.file_path)}`,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  } catch (e) {
    return sendJson(res, 500, { error: 'Upload failed' });
  }
};

module.exports.config = { api: { bodyParser: false } };
