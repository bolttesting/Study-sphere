const path = require('path');
const fs = require('fs');
const os = require('os');
const formidableLib = require('formidable');
const { createClient } = require('@supabase/supabase-js');
const { PDFDocument, StandardFonts } = require('pdf-lib');

let cachedPdfParse = null;
let pdfParseLoadAttempted = false;

function getPdfParse() {
  if (pdfParseLoadAttempted) return cachedPdfParse;
  pdfParseLoadAttempted = true;
  try {
    cachedPdfParse = require('pdf-parse');
  } catch (_) {
    cachedPdfParse = null;
  }
  return cachedPdfParse;
}

function sendJson(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseClients() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { supabaseAdmin, supabasePublic };
}

function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

async function getAuthContext(req, res, supabaseAdmin, supabasePublic, adminOnly = false) {
  const token = getBearerToken(req);
  if (!token) {
    sendJson(res, 401, { error: 'Missing token' });
    return null;
  }

  const { data: userData, error: userErr } = await supabasePublic.auth.getUser(token);
  if (userErr || !userData?.user) {
    sendJson(res, 401, { error: userErr?.message || 'Invalid token' });
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (adminOnly && profile?.role !== 'Admin') {
    sendJson(res, 403, { error: 'Admin access required.' });
    return null;
  }

  return { user: userData.user, profile };
}

async function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};

  // Fallback for runtimes where body parsing is disabled/unavailable.
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function parseForm(req) {
  const formFactory =
    formidableLib.formidable ||
    formidableLib.default ||
    null;

  const formOptions = {
    multiples: false,
    keepExtensions: true,
    uploadDir: os.tmpdir(),
    maxFileSize: 20 * 1024 * 1024,
  };

  const form = formFactory
    ? formFactory(formOptions)
    : new formidableLib.IncomingForm(formOptions);

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function getField(fields, key) {
  const v = fields[key];
  return Array.isArray(v) ? v[0] : v;
}

function getFile(files, key) {
  const v = files[key];
  return Array.isArray(v) ? v[0] : v;
}

function decodePdfLiteralString(literal) {
  if (!literal) return '';
  let out = '';
  for (let i = 0; i < literal.length; i += 1) {
    const ch = literal[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = literal[i + 1];
    if (!next) break;
    if (next === 'n') { out += '\n'; i += 1; continue; }
    if (next === 'r') { out += '\r'; i += 1; continue; }
    if (next === 't') { out += '\t'; i += 1; continue; }
    if (next === 'b') { out += '\b'; i += 1; continue; }
    if (next === 'f') { out += '\f'; i += 1; continue; }
    if (next === '(' || next === ')' || next === '\\') { out += next; i += 1; continue; }
    if (/[0-7]/.test(next)) {
      let oct = next;
      if (/[0-7]/.test(literal[i + 2] || '')) oct += literal[i + 2];
      if (/[0-7]/.test(literal[i + 3] || '')) oct += literal[i + 3];
      out += String.fromCharCode(parseInt(oct, 8));
      i += oct.length;
      continue;
    }
    out += next;
    i += 1;
  }
  return out;
}

function extractPdfTextHeuristic(buffer) {
  // Best-effort fallback: parse PDF text show operators when parser fails.
  const raw = buffer.toString('latin1');
  const chunks = [];

  const tjRegex = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  const tjArrayRegex = /\[(.*?)\]\s*TJ/gs;

  const tjMatches = raw.match(tjRegex) || [];
  for (const match of tjMatches) {
    const start = match.indexOf('(');
    const end = match.lastIndexOf(')');
    if (start >= 0 && end > start) {
      chunks.push(decodePdfLiteralString(match.slice(start + 1, end)));
    }
  }

  let m;
  while ((m = tjArrayRegex.exec(raw)) !== null) {
    const arr = m[1] || '';
    const litRegex = /\((?:\\.|[^\\)])*\)/g;
    const literals = arr.match(litRegex) || [];
    for (const lit of literals) {
      chunks.push(decodePdfLiteralString(lit.slice(1, -1)));
    }
  }

  return chunks
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readUploadedFile(file) {
  const sourcePath = file?.filepath || file?.path;
  if (!sourcePath) throw new Error('Uploaded file path is missing.');
  return fs.promises.readFile(sourcePath);
}

async function runQuickCrawler(question) {
  const q = (question || '').trim();
  if (!q) return '';

  try {
    const ddg = new URL('https://api.duckduckgo.com/');
    ddg.searchParams.set('q', q);
    ddg.searchParams.set('format', 'json');
    ddg.searchParams.set('no_html', '1');
    ddg.searchParams.set('no_redirect', '1');

    const resp = await fetch(ddg.toString());
    if (!resp.ok) return '';
    const data = await resp.json();

    const lines = [];
    if (data.AbstractText) lines.push(data.AbstractText);
    if (Array.isArray(data.RelatedTopics)) {
      for (const item of data.RelatedTopics) {
        if (item?.Text) lines.push(item.Text);
        if (Array.isArray(item?.Topics)) {
          for (const child of item.Topics) {
            if (child?.Text) lines.push(child.Text);
            if (lines.length >= 3) break;
          }
        }
        if (lines.length >= 3) break;
      }
    }
    return lines.slice(0, 3).join('\n');
  } catch (_) {
    return '';
  }
}

async function extractPdfTextFromStorage(supabaseAdmin, bucket, filePath) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(filePath);
  if (error || !data) return '';

  try {
    const pdfParse = getPdfParse();
    if (!pdfParse) return '';
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let parsedText = '';

    // Support both legacy pdf-parse function API and v2 class API.
    if (typeof pdfParse === 'function') {
      const parsed = await pdfParse(buffer);
      parsedText = parsed?.text || '';
    } else if (typeof pdfParse?.PDFParse === 'function') {
      const parser = new pdfParse.PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        parsedText = parsed?.text || '';
      } finally {
        if (typeof parser.destroy === 'function') {
          await parser.destroy();
        }
      }
    }

    const cleaned = parsedText.replace(/\s+\n/g, '\n').trim();
    if (cleaned) return cleaned;

    const heuristic = extractPdfTextHeuristic(buffer);
    return heuristic;
  } catch (_) {
    return '';
  }
}

async function askGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
            'You are an academic assistant for matric students. Respond clearly and concisely. If uncertain, explicitly say so.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || null;
}

function looksLikeNoAnswer(text) {
  const normalized = (text || '').toLowerCase();
  if (!normalized) return true;
  const markers = [
    'image-only',
    'scanned file',
    'unreadable',
    'no readable text extracted',
    'i could not confidently answer',
    "i don't have this answer",
    'i do not have this answer',
    'not enough information',
    'cannot find',
    'unable to answer',
  ];
  return markers.some((token) => normalized.includes(token));
}

module.exports = async function handler(req, res) {
  try {
    const { supabaseAdmin, supabasePublic } = getSupabaseClients();
    const rawPath = req.query.path;
    const routePath = (Array.isArray(rawPath) ? rawPath.join('/') : rawPath || '').replace(/^\/+/, '');
    const parts = routePath.split('/').filter(Boolean);

    if (parts.length === 0) return sendJson(res, 404, { error: 'Not found' });

    // Auth routes
    if (parts[0] === 'auth') {
      if (parts[1] === 'signup' && req.method === 'POST') {
        const body = await parseBody(req);
        const { email, password, firstName, lastName, role, class_name } = body;
        if (!email || !password || !firstName || !lastName || !role) {
          return sendJson(res, 400, { error: 'Missing required fields' });
        }

        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { firstName, lastName },
        });
        if (createError || !created?.user) {
          return sendJson(res, 400, { error: createError?.message || 'Signup failed' });
        }

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
        if (signInError || !signInData?.session) {
          return sendJson(res, 400, { error: signInError?.message || 'Auto login failed' });
        }

        return sendJson(res, 201, {
          access: signInData.session.access_token,
          refresh: signInData.session.refresh_token,
          user: { email, firstName, lastName, role, class_name: profilePayload.class_name },
        });
      }

      if (parts[1] === 'login' && req.method === 'POST') {
        const body = await parseBody(req);
        const { email, password } = body;
        if (!email || !password) return sendJson(res, 400, { error: 'Email and password required' });

        const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });
        if (error || !data?.session || !data?.user) return sendJson(res, 401, { error: error?.message || 'Invalid credentials' });

        const { data: profile } = await supabasePublic
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        return sendJson(res, 200, {
          access: data.session.access_token,
          refresh: data.session.refresh_token,
          user: {
            email: data.user.email,
            firstName: profile?.first_name || '',
            lastName: profile?.last_name || '',
            role: profile?.role || 'Student',
            class_name: profile?.class_name || null,
          },
        });
      }

      if (parts[1] === 'logout' && req.method === 'POST') return sendJson(res, 200, { ok: true });
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    if (parts[0] === 'profile') {
      const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, false);
      if (!auth) return;

      if (req.method === 'GET') {
        return sendJson(res, 200, {
          user: {
            email: auth.profile?.email || auth.user.email,
            firstName: auth.profile?.first_name || '',
            lastName: auth.profile?.last_name || '',
            role: auth.profile?.role || 'Student',
            class_name: auth.profile?.class_name || null,
          },
        });
      }

      if (req.method === 'PATCH') {
        const body = await parseBody(req);
        const { firstName, lastName, class_name, password } = body;
        const updates = {};
        if (typeof firstName === 'string') updates.first_name = firstName;
        if (typeof lastName === 'string') updates.last_name = lastName;
        if (typeof class_name === 'string') updates.class_name = class_name || null;
        if (Object.keys(updates).length) {
          updates.updated_at = new Date().toISOString();
          const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', auth.user.id);
          if (error) return sendJson(res, 400, { error: error.message });
        }
        if (password) {
          const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(auth.user.id, { password });
          if (pwdError) return sendJson(res, 400, { error: pwdError.message });
        }
        const { data: profile, error } = await supabaseAdmin.from('profiles').select('*').eq('id', auth.user.id).single();
        if (error) return sendJson(res, 400, { error: error.message });
        return sendJson(res, 200, {
          user: {
            email: profile.email,
            firstName: profile.first_name,
            lastName: profile.last_name,
            role: profile.role,
            class_name: profile.class_name,
          },
        });
      }
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    if (parts[0] === 'notes') {
      if (parts[1] === 'upload') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, true);
        if (!auth) return;
        const { fields, files } = await parseForm(req);
        const title = getField(fields, 'title');
        const subject = getField(fields, 'subject');
        const class_name = getField(fields, 'class_name');
        const file = getFile(files, 'file');
        if (!title || !subject || !class_name || !file) return sendJson(res, 400, { error: 'Missing required fields' });
        const ext = path.extname(file.originalFilename || '.pdf');
        const storagePath = `${auth.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const buffer = await readUploadedFile(file);
        const { error: uploadErr } = await supabaseAdmin.storage.from('notes').upload(storagePath, buffer, {
          contentType: file.mimetype || 'application/pdf',
          upsert: false,
        });
        if (uploadErr) return sendJson(res, 400, { error: uploadErr.message });
        const { data, error } = await supabaseAdmin
          .from('notes')
          .insert({ title, subject, class_name, file_path: storagePath, uploaded_by: auth.user.id })
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
      }

      if (parts.length === 1 && req.method === 'GET') {
        const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, false);
        if (!auth) return;
        const { class_name, subject } = req.query || {};
        let query = supabaseAdmin.from('notes').select('*').order('created_at', { ascending: false });
        if (auth.profile?.role !== 'Admin' && auth.profile?.class_name) query = query.eq('class_name', auth.profile.class_name);
        if (class_name) query = query.eq('class_name', class_name);
        if (subject) query = query.eq('subject', subject);
        const { data, error } = await query;
        if (error) return sendJson(res, 400, { error: error.message });
        return sendJson(
          res,
          200,
          (data || []).map((row) => ({
            id: row.id,
            title: row.title,
            subject: row.subject,
            class_name: row.class_name,
            file: `/api/files/notes/${encodeURIComponent(row.file_path)}`,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }))
        );
      }

      if (parts.length === 2) {
        const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, true);
        if (!auth) return;
        const id = parts[1];
        const { data: existing } = await supabaseAdmin.from('notes').select('*').eq('id', id).single();
        if (!existing) return sendJson(res, 404, { error: 'Note not found' });

        if (req.method === 'DELETE') {
          if (existing.file_path) await supabaseAdmin.storage.from('notes').remove([existing.file_path]);
          const { error } = await supabaseAdmin.from('notes').delete().eq('id', id);
          if (error) return sendJson(res, 400, { error: error.message });
          return res.status(204).end();
        }

        if (req.method === 'PUT') {
          const { fields, files } = await parseForm(req);
          const title = getField(fields, 'title') || existing.title;
          const subject = getField(fields, 'subject') || existing.subject;
          const class_name = getField(fields, 'class_name') || existing.class_name;
          const file = getFile(files, 'file');
          let file_path = existing.file_path;
          if (file) {
            const ext = path.extname(file.originalFilename || '.pdf');
            file_path = `${auth.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
            const buffer = await readUploadedFile(file);
            const { error: uploadErr } = await supabaseAdmin.storage.from('notes').upload(file_path, buffer, {
              contentType: file.mimetype || 'application/pdf',
              upsert: false,
            });
            if (uploadErr) return sendJson(res, 400, { error: uploadErr.message });
            if (existing.file_path) await supabaseAdmin.storage.from('notes').remove([existing.file_path]);
          }
          const { data, error } = await supabaseAdmin
            .from('notes')
            .update({ title, subject, class_name, file_path, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single();
          if (error) return sendJson(res, 400, { error: error.message });
          return sendJson(res, 200, {
            id: data.id,
            title: data.title,
            subject: data.subject,
            class_name: data.class_name,
            file: `/api/files/notes/${encodeURIComponent(data.file_path)}`,
            created_at: data.created_at,
            updated_at: data.updated_at,
          });
        }
      }

      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    if (parts[0] === 'past-papers') {
      if (parts[1] === 'upload') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
        const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, true);
        if (!auth) return;
        const { fields, files } = await parseForm(req);
        const title = getField(fields, 'title');
        const subject = getField(fields, 'subject');
        const class_name = getField(fields, 'class_name');
        const year = getField(fields, 'year');
        const exam_type = getField(fields, 'exam_type') || 'Board';
        const file = getFile(files, 'file');
        if (!title || !subject || !class_name || !year || !file) return sendJson(res, 400, { error: 'Missing required fields' });
        const ext = path.extname(file.originalFilename || '.pdf');
        const storagePath = `${auth.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const buffer = await readUploadedFile(file);
        const { error: uploadErr } = await supabaseAdmin.storage.from('past-papers').upload(storagePath, buffer, {
          contentType: file.mimetype || 'application/pdf',
          upsert: false,
        });
        if (uploadErr) return sendJson(res, 400, { error: uploadErr.message });
        const { data, error } = await supabaseAdmin
          .from('past_papers')
          .insert({ title, subject, class_name, year, exam_type, file_path: storagePath, uploaded_by: auth.user.id })
          .select('*')
          .single();
        if (error) return sendJson(res, 400, { error: error.message });
        return sendJson(res, 201, {
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
      }

      if (parts.length === 1 && req.method === 'GET') {
        const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, false);
        if (!auth) return;
        const { class_name, subject, year } = req.query || {};
        let query = supabaseAdmin.from('past_papers').select('*').order('created_at', { ascending: false });
        if (auth.profile?.role !== 'Admin' && auth.profile?.class_name) query = query.eq('class_name', auth.profile.class_name);
        if (class_name) query = query.eq('class_name', class_name);
        if (subject) query = query.eq('subject', subject);
        if (year) query = query.eq('year', year);
        const { data, error } = await query;
        if (error) return sendJson(res, 400, { error: error.message });
        return sendJson(
          res,
          200,
          (data || []).map((row) => ({
            id: row.id,
            title: row.title,
            subject: row.subject,
            class_name: row.class_name,
            year: row.year,
            exam_type: row.exam_type,
            file: `/api/files/past-papers/${encodeURIComponent(row.file_path)}`,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }))
        );
      }

      if (parts.length === 2) {
        const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, true);
        if (!auth) return;
        const id = parts[1];
        const { data: existing } = await supabaseAdmin.from('past_papers').select('*').eq('id', id).single();
        if (!existing) return sendJson(res, 404, { error: 'Past paper not found' });
        if (req.method === 'DELETE') {
          if (existing.file_path) await supabaseAdmin.storage.from('past-papers').remove([existing.file_path]);
          const { error } = await supabaseAdmin.from('past_papers').delete().eq('id', id);
          if (error) return sendJson(res, 400, { error: error.message });
          return res.status(204).end();
        }
        if (req.method === 'PUT') {
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
            const buffer = await readUploadedFile(file);
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
        }
      }

      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    if (parts[0] === 'chat') {
      const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, false);
      if (!auth) return;
      if (parts[1] === 'sessions' && parts.length === 2) {
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
          return sendJson(
            res,
            200,
            (data || []).map((s) => ({
              id: s.id,
              title: s.title,
              mode: s.mode,
              created_at: s.created_at,
              updated_at: s.updated_at,
              last_message: lastMap[s.id]?.content?.slice(0, 80) || '',
              message_count: 0,
            }))
          );
        }

        if (req.method === 'POST') {
          const body = await parseBody(req);
          const { title = 'New Chat', mode = 'GENERAL' } = body;
          const { data, error } = await supabaseAdmin
            .from('chat_sessions')
            .insert({ user_id: auth.user.id, title, mode })
            .select('*')
            .single();
          if (error) return sendJson(res, 400, { error: error.message });
          return sendJson(res, 201, data);
        }
      }

      if (parts[1] === 'sessions' && parts.length === 3) {
        const id = parts[2];
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
      }

      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    if (parts[0] === 'chatbot' && req.method === 'POST') {
      const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, false);
      if (!auth) return;
      const body = await parseBody(req);
      const { message, mode = 'GENERAL', selected_note_ids = [], session_id = null } = body;
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
          .insert({ user_id: auth.user.id, mode, title: message.slice(0, 80) })
          .select('*')
          .single();
        session = data;
      }
      await supabaseAdmin.from('chat_messages').insert({ session_id: session.id, role: 'user', content: message });

      let contextBlock = '';
      let allSelectedNotesUnreadable = false;
      let readableNotesCount = 0;
      if (mode === 'RAG' && selected_note_ids.length) {
        let notesQuery = supabaseAdmin
          .from('notes')
          .select('id,title,subject,class_name,file_path')
          .in('id', selected_note_ids);
        if (auth.profile?.role !== 'Admin' && auth.profile?.class_name) {
          notesQuery = notesQuery.eq('class_name', auth.profile.class_name);
        }
        const { data: notes } = await notesQuery;

        const noteSummaries = [];
        for (const note of notes || []) {
          const extractedText = await extractPdfTextFromStorage(supabaseAdmin, 'notes', note.file_path);
          const snippet = extractedText.slice(0, 3500);
          if (snippet.trim()) readableNotesCount += 1;
          noteSummaries.push(
            `--- Note: ${note.title} (${note.subject}, ${note.class_name}) ---\n` +
            (snippet || '[No readable text extracted. This file may be image-only/scanned.]')
          );
        }
        allSelectedNotesUnreadable = (notes || []).length > 0 && readableNotesCount === 0;

        contextBlock = [
          'Use ONLY the provided selected note content.',
          'If the selected note has no readable text, explicitly mention that the file appears image-only/scanned.',
          `Selected notes metadata:\n${(notes || []).map((n) => `- ${n.title} (${n.subject}, ${n.class_name})`).join('\n')}`,
          `Extracted note content:\n${noteSummaries.join('\n\n')}`,
        ].join('\n\n');
      }
      const prompt = `${contextBlock}\n\nStudent question:\n${message}\n\nAnswer in a concise study-friendly way.`;
      let reply = await askGroq(prompt);
      let unanswered = allSelectedNotesUnreadable;
      if (!reply) {
        reply = 'I could not confidently answer that right now. You can submit this query for admin review.';
        unanswered = true;
      }

      // If we have readable note text, do not allow false "unreadable/image-only" outcomes.
      if (mode === 'RAG' && readableNotesCount > 0 && looksLikeNoAnswer(reply)) {
        const strictPrompt = [
          contextBlock,
          '',
          `Student question:\n${message}`,
          '',
          'You have readable text from the selected note. Do NOT claim the note is image-only/unreadable.',
          'Answer using only the extracted note content and keep it concise and study-friendly.',
        ].join('\n');
        const retry = await askGroq(strictPrompt);
        if (retry && !looksLikeNoAnswer(retry)) {
          reply = retry;
        }
      }

      if (looksLikeNoAnswer(reply)) {
        unanswered = true;
      } else if (mode === 'RAG' && readableNotesCount > 0) {
        unanswered = false;
      }
      await supabaseAdmin.from('chat_messages').insert({ session_id: session.id, role: 'assistant', content: reply });
      await supabaseAdmin.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', session.id);
      return sendJson(res, 200, { session_id: session.id, reply, sources: [], unanswered });
    }

    if (parts[0] === 'queries') {
      if (parts[1] === 'submit' && req.method === 'POST') {
        const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, false);
        if (!auth) return;
        const body = await parseBody(req);
        const { question, student_email } = body;
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
      }

      if (parts.length === 1 && req.method === 'GET') {
        const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, false);
        if (!auth) return;
        let query = supabaseAdmin.from('student_queries').select('*').order('created_at', { ascending: false });
        if (auth.profile?.role !== 'Admin') query = query.eq('student_id', auth.user.id);
        else if (req.query.status) query = query.eq('status', req.query.status);
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
        return sendJson(
          res,
          200,
          rows.map((r) => ({
            ...r,
            student: r.student_id,
            student_name: profileMap[r.student_id] || 'Student',
          }))
        );
      }

      if (parts.length === 3 && parts[2] === 'resolve' && req.method === 'PATCH') {
        const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, true);
        if (!auth) return;
        const body = await parseBody(req);
        const { admin_answer } = body;
        if (!admin_answer) return sendJson(res, 400, { error: 'Answer is required' });
        const { data, error } = await supabaseAdmin
          .from('student_queries')
          .update({
            admin_answer,
            status: 'resolved',
            resolved_by: auth.user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', parts[1])
          .select('*')
          .single();
        if (error || !data) return sendJson(res, 404, { error: error?.message || 'Query not found' });
        return sendJson(res, 200, { ...data, student: data.student_id });
      }

      if (parts.length === 3 && parts[2] === 'crawl' && req.method === 'POST') {
        const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, true);
        if (!auth) return;

        const queryId = parts[1];
        const { data: existing, error: existingError } = await supabaseAdmin
          .from('student_queries')
          .select('*')
          .eq('id', queryId)
          .single();

        if (existingError || !existing) {
          return sendJson(res, 404, { error: existingError?.message || 'Query not found' });
        }

        const spiderResult = await runQuickCrawler(existing.question);
        const { data, error } = await supabaseAdmin
          .from('student_queries')
          .update({
            spider_result: spiderResult || 'Crawler could not find a clear match.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', queryId)
          .select('*')
          .single();

        if (error || !data) return sendJson(res, 400, { error: error?.message || 'Crawler update failed' });
        return sendJson(res, 200, { ...data, student: data.student_id });
      }

      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    if (parts[0] === 'videos' && req.method === 'GET') {
      const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, false);
      if (!auth) return;
      const q = (req.query.q || '').trim();
      if (!q) return sendJson(res, 400, { error: 'Provide ?q=' });
      const key = process.env.YOUTUBE_API_KEY;
      if (!key) return sendJson(res, 503, { error: 'YouTube API key not configured.' });
      try {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.set('part', 'snippet');
        url.searchParams.set('q', q);
        url.searchParams.set('type', 'video');
        url.searchParams.set('maxResults', '3');
        url.searchParams.set('key', key);
        url.searchParams.set('order', 'relevance');
        url.searchParams.set('videoCategoryId', '27');
        url.searchParams.set('relevanceLanguage', 'en');
        url.searchParams.set('safeSearch', 'strict');
        const resp = await fetch(url.toString());
        if (!resp.ok) return sendJson(res, 503, { error: 'Failed to reach YouTube API.' });
        const data = await resp.json();
        const videos = (data.items || [])
          .map((item) => ({
            id: item.id?.videoId,
            title: item.snippet?.title || '',
            channel: item.snippet?.channelTitle || '',
            description: (item.snippet?.description || '').slice(0, 120),
            thumbnail: item.snippet?.thumbnails?.medium?.url || '',
            url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
            published: (item.snippet?.publishedAt || '').slice(0, 10),
          }))
          .filter((v) => v.id);
        return sendJson(res, 200, { videos, query: q });
      } catch (e) {
        return sendJson(res, 503, { error: 'Failed to reach YouTube API.' });
      }
    }

    if (parts[0] === 'generate-paper') {
      const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, false);
      if (!auth) return;
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
      const body = await parseBody(req);
      const { past_paper_id, difficulty = 'medium', num_questions = 10 } = body;
      if (!past_paper_id) return sendJson(res, 400, { error: 'past_paper_id is required' });
      const { data: paper, error } = await supabaseAdmin.from('past_papers').select('*').eq('id', past_paper_id).single();
      if (error || !paper) return sendJson(res, 404, { error: 'Past paper not found' });

      const prompt = [
        `Create a ${difficulty} guess paper for class ${paper.class_name} ${paper.subject}.`,
        `Generate exactly ${num_questions} questions.`,
        'Use clear numbered format and include a short answer key at the end.',
      ].join('\n');
      const generated = (await askGroq(prompt)) || 'Could not generate paper right now.';

      if (parts[1] === 'pdf') {
        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        let page = pdf.addPage([595, 842]);
        let y = 810;
        page.drawText(`Guess Paper - ${paper.subject} (${paper.class_name})`, { x: 40, y, size: 14, font });
        y -= 24;
        page.drawText(`Difficulty: ${difficulty} | Questions: ${num_questions}`, { x: 40, y, size: 11, font });
        y -= 20;
        for (const line of generated.split('\n')) {
          if (y < 40) {
            page = pdf.addPage([595, 842]);
            y = 810;
          }
          page.drawText(line.slice(0, 110), { x: 40, y, size: 11, font });
          y -= 14;
        }
        const bytes = await pdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=\"guess-paper.pdf\"');
        return res.status(200).end(Buffer.from(bytes));
      }

      return sendJson(res, 200, {
        class_name: paper.class_name,
        subject: paper.subject,
        difficulty,
        num_questions,
        generated_paper: generated,
      });
    }

    if (parts[0] === 'files' && req.method === 'GET') {
      const auth = await getAuthContext(req, res, supabaseAdmin, supabasePublic, false);
      if (!auth) return;
      const bucket = parts[1];
      const filePath = decodeURIComponent(parts.slice(2).join('/'));
      if (!bucket || !filePath) return sendJson(res, 400, { error: 'Missing file path' });
      const { data, error } = await supabaseAdmin.storage.from(bucket).download(filePath);
      if (error || !data) return sendJson(res, 404, { error: 'File not found' });
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', data.type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename=\"${filePath.split('/').pop()}\"`);
      return res.status(200).end(buffer);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('api index error:', err);
    return sendJson(res, 500, { error: err?.message || 'Internal server error' });
  }
};

module.exports.config = { api: { bodyParser: false } };
