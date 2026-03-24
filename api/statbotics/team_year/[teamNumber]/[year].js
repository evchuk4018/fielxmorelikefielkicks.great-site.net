export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const teamNumber = req.query?.teamNumber;
  const year = req.query?.year;

  if (!teamNumber || Array.isArray(teamNumber)) {
    return res.status(400).json({ error: 'teamNumber is required' });
  }

  if (!year || Array.isArray(year)) {
    return res.status(400).json({ error: 'year is required' });
  }

  const normalizedTeamNumber = Number(teamNumber);
  const normalizedYear = Number(year);

  if (!Number.isInteger(normalizedTeamNumber) || normalizedTeamNumber <= 0) {
    return res.status(400).json({ error: 'teamNumber must be a positive integer' });
  }

  if (!Number.isInteger(normalizedYear) || normalizedYear < 1992 || normalizedYear > 2100) {
    return res.status(400).json({ error: 'year must be a valid FRC season year' });
  }

  const targetUrl = `https://api.statbotics.io/v3/team_year/${normalizedTeamNumber}/${normalizedYear}`;

  console.log('[api/statbotics/team_year] request', {
    teamNumber: normalizedTeamNumber,
    year: normalizedYear,
    targetUrl,
  });

  try {
    const response = await fetch(targetUrl);
    const body = await response.text();

    if (!response.ok) {
      console.error('[api/statbotics/team_year] upstream failed', {
        teamNumber: normalizedTeamNumber,
        year: normalizedYear,
        status: response.status,
      });
      return res.status(response.status).json({ error: `Statbotics request failed with status ${response.status}` });
    }

    const payload = JSON.parse(body);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('[api/statbotics/team_year] exception', {
      teamNumber: normalizedTeamNumber,
      year: normalizedYear,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to fetch team year from Statbotics' });
  }
}
