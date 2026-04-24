const { sendJson, requireAuth } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const auth = await requireAuth(req, res);
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
    const videos = (data.items || []).map((item) => ({
      id: item.id?.videoId,
      title: item.snippet?.title || '',
      channel: item.snippet?.channelTitle || '',
      description: (item.snippet?.description || '').slice(0, 120),
      thumbnail: item.snippet?.thumbnails?.medium?.url || '',
      url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      published: (item.snippet?.publishedAt || '').slice(0, 10),
    })).filter((v) => v.id);

    return sendJson(res, 200, { videos, query: q });
  } catch (e) {
    return sendJson(res, 503, { error: 'Failed to reach YouTube API.' });
  }
};
