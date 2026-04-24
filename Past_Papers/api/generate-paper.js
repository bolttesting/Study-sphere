const { supabaseAdmin } = require('./_lib/supabase');
const { sendJson, requireAuth } = require('./_lib/auth');
const { askGroq } = require('./_lib/llm');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { past_paper_id, difficulty = 'medium', num_questions = 10 } = req.body || {};
  if (!past_paper_id) return sendJson(res, 400, { error: 'past_paper_id is required' });

  const { data: paper, error } = await supabaseAdmin.from('past_papers').select('*').eq('id', past_paper_id).single();
  if (error || !paper) return sendJson(res, 404, { error: 'Past paper not found' });

  const prompt = [
    `Create a ${difficulty} guess paper for class ${paper.class_name} ${paper.subject}.`,
    `Generate exactly ${num_questions} questions.`,
    'Use clear numbered format and include a short answer key at the end.',
    `Context from paper metadata: title=${paper.title}, year=${paper.year}, exam_type=${paper.exam_type}.`,
  ].join('\n');

  const generated = (await askGroq(prompt)) || 'Could not generate paper right now.';
  return sendJson(res, 200, {
    class_name: paper.class_name,
    subject: paper.subject,
    difficulty,
    num_questions,
    generated_paper: generated,
  });
};
