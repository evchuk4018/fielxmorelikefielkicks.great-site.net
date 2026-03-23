function normalizeEventKey(eventKey) {
  if (typeof eventKey !== 'string') return null;
  const normalized = eventKey.trim().toLowerCase();
  // Expected format is year + event code, e.g. 2026paphi.
  const match = normalized.match(/^\d{4}[a-z0-9]+$/);
  if (!match) return null;
  return normalized;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const eventKey = req.query?.eventKey;
  if (!eventKey || Array.isArray(eventKey)) {
    return res.status(400).json({ error: 'eventKey is required' });
  }

  const normalizedEventKey = normalizeEventKey(eventKey);
  if (!normalizedEventKey) {
    return res.status(400).json({ error: 'Invalid eventKey format' });
  }

  try {
    const url = `https://api.statbotics.io/v3/event/${normalizedEventKey}/teams`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Statbotics request failed with status ${response.status}` });
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch Statbotics data' });
  }
}
