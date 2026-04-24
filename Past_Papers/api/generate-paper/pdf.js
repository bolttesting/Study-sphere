const { PDFDocument, StandardFonts } = require('pdf-lib');
const { supabaseAdmin } = require('../_lib/supabase');
const { requireAuth } = require('../_lib/auth');
const { askGroq } = require('../_lib/llm');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { past_paper_id, difficulty = 'medium', num_questions = 10 } = req.body || {};
  if (!past_paper_id) return res.status(400).json({ error: 'past_paper_id is required' });

  const { data: paper, error } = await supabaseAdmin.from('past_papers').select('*').eq('id', past_paper_id).single();
  if (error || !paper) return res.status(404).json({ error: 'Past paper not found' });

  const prompt = [
    `Create a ${difficulty} guess paper for class ${paper.class_name} ${paper.subject}.`,
    `Generate exactly ${num_questions} questions.`,
    'Use clear numbered format and include a short answer key at the end.',
  ].join('\n');
  const generated = (await askGroq(prompt)) || 'Could not generate paper right now.';

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]);
  const size = 11;
  let y = 810;

  const title = `Guess Paper - ${paper.subject} (${paper.class_name})`;
  page.drawText(title, { x: 40, y, size: 14, font });
  y -= 24;
  page.drawText(`Difficulty: ${difficulty} | Questions: ${num_questions}`, { x: 40, y, size, font });
  y -= 20;

  const lines = generated.split('\n');
  for (const line of lines) {
    if (y < 40) {
      page = pdf.addPage([595, 842]);
      y = 810;
    }
    page.drawText(line.slice(0, 110), { x: 40, y, size, font });
    y -= 14;
  }

  const bytes = await pdf.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=\"guess-paper.pdf\"');
  return res.status(200).end(Buffer.from(bytes));
};
