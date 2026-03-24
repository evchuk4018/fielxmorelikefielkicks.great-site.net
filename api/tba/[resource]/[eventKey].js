const RESOURCE_MAP = {
  event: {
    pathSuffix: 'simple',
    errorMessage: 'Failed to fetch event info from TBA',
    logName: 'event',
  },
  teams: {
    pathSuffix: 'teams/simple',
    errorMessage: 'Failed to fetch teams from TBA',
    logName: 'teams',
  },
  matches: {
    pathSuffix: 'matches/simple',
    errorMessage: 'Failed to fetch matches from TBA',
    logName: 'matches',
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TBA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TBA_API_KEY is not configured' });
  }

  const resource = req.query?.resource;
  const eventKey = req.query?.eventKey;
  if (!resource || Array.isArray(resource) || !eventKey || Array.isArray(eventKey)) {
    return res.status(400).json({ error: 'resource and eventKey are required' });
  }

  const config = RESOURCE_MAP[resource];
  if (!config) {
    return res.status(400).json({ error: 'Unsupported TBA resource' });
  }

  const normalizedEventKey = eventKey.trim().toLowerCase();

  console.log(`[api/tba/${config.logName}] request`, {
    originalEventKey: eventKey,
    normalizedEventKey,
  });

  try {
    const response = await fetch(
      `https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/${config.pathSuffix}`,
      {
        headers: {
          'X-TBA-Auth-Key': apiKey,
        },
      },
    );

    if (!response.ok) {
      console.error(`[api/tba/${config.logName}] upstream failed`, {
        normalizedEventKey,
        status: response.status,
      });
      return res.status(response.status).json({ error: `TBA request failed with status ${response.status}` });
    }

    const data = await response.json();
    console.log(`[api/tba/${config.logName}] success`, {
      normalizedEventKey,
      count: Array.isArray(data) ? data.length : null,
      eventName: !Array.isArray(data) ? data?.name || null : null,
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error(`[api/tba/${config.logName}] exception`, {
      normalizedEventKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: config.errorMessage });
  }
}