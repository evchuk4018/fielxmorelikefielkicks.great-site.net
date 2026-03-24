export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const eventKey = req.query?.eventKey;
  if (!eventKey || Array.isArray(eventKey)) {
    return res.status(400).json({ error: 'eventKey query parameter is required' });
  }

  const normalizedEventKey = eventKey.trim().toLowerCase();
  const targetUrl = `https://api.statbotics.io/v3/teams/${encodeURIComponent(normalizedEventKey)}`;

  console.log('[api/statbotics/teams_by_event] request', {
    originalEventKey: eventKey,
    normalizedEventKey,
    targetUrl,
  });

  try {
    const response = await fetch(targetUrl);
    const body = await response.text();

    if (!response.ok) {
      console.error('[api/statbotics/teams_by_event] upstream failed', {
        normalizedEventKey,
        status: response.status,
      });
      return res.status(response.status).json({ error: `Statbotics request failed with status ${response.status}` });
    }

    const payload = JSON.parse(body);
    console.log('[api/statbotics/teams_by_event] success', {
      normalizedEventKey,
      rows: Array.isArray(payload) ? payload.length : 0,
    });
    return res.status(200).json(payload);
  } catch (error) {
    console.error('[api/statbotics/teams_by_event] exception', {
      normalizedEventKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to fetch event teams from Statbotics' });
  }
}
