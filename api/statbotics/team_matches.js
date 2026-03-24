export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const team = req.query?.team;
  const eventKey = req.query?.eventKey || req.query?.event || req.query?.event_key;

  if (!team || Array.isArray(team)) {
    return res.status(400).json({ error: 'team query parameter is required' });
  }

  if (!eventKey || Array.isArray(eventKey)) {
    return res.status(400).json({ error: 'eventKey query parameter is required' });
  }

  const normalizedTeamNumber = Number(team);
  const normalizedEventKey = String(eventKey).trim().toLowerCase();

  if (!Number.isInteger(normalizedTeamNumber) || normalizedTeamNumber <= 0) {
    return res.status(400).json({ error: 'team must be a positive integer' });
  }

  const candidateUrls = [
    `https://api.statbotics.io/v3/team_matches?team=${normalizedTeamNumber}&event=${encodeURIComponent(normalizedEventKey)}`,
    `https://api.statbotics.io/v3/team_matches?team=${normalizedTeamNumber}&event_key=${encodeURIComponent(normalizedEventKey)}`,
  ];

  let lastErrorStatus = 500;
  let lastErrorMessage = 'Failed to fetch team matches from Statbotics';

  for (const targetUrl of candidateUrls) {
    try {
      const response = await fetch(targetUrl);
      const body = await response.text();

      if (!response.ok) {
        lastErrorStatus = response.status;
        lastErrorMessage = `Statbotics request failed with status ${response.status}`;
        continue;
      }

      const payload = JSON.parse(body);
      return res.status(200).json(payload);
    } catch (error) {
      lastErrorStatus = 500;
      lastErrorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  return res.status(lastErrorStatus).json({ error: lastErrorMessage });
}
