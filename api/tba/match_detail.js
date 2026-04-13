export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TBA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TBA_API_KEY is not configured' });
  }

  const matchKey = req.query?.matchKey;
  if (!matchKey || Array.isArray(matchKey)) {
    return res.status(400).json({ error: 'matchKey query parameter is required' });
  }

  const normalizedMatchKey = matchKey.trim().toLowerCase();
  if (!normalizedMatchKey) {
    return res.status(400).json({ error: 'matchKey query parameter is required' });
  }

  const targetUrl = `https://www.thebluealliance.com/api/v3/match/${encodeURIComponent(normalizedMatchKey)}`;

  console.log('[api/tba/match_detail] request', {
    originalMatchKey: matchKey,
    normalizedMatchKey,
  });

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'X-TBA-Auth-Key': apiKey,
      },
    });

    if (!response.ok) {
      console.error('[api/tba/match_detail] upstream failed', {
        normalizedMatchKey,
        status: response.status,
      });
      return res.status(response.status).json({ error: `TBA request failed with status ${response.status}` });
    }

    const data = await response.json();
    console.log('[api/tba/match_detail] success', {
      normalizedMatchKey,
      videoCount: Array.isArray(data?.videos) ? data.videos.length : 0,
    });

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch (error) {
    console.error('[api/tba/match_detail] exception', {
      normalizedMatchKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to fetch match detail from TBA' });
  }
}
