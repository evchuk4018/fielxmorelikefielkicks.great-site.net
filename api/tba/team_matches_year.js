export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TBA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TBA_API_KEY is not configured' });
  }

  const team = req.query?.team;
  const year = req.query?.year;

  if (!team || Array.isArray(team)) {
    return res.status(400).json({ error: 'team query parameter is required' });
  }

  if (!year || Array.isArray(year)) {
    return res.status(400).json({ error: 'year query parameter is required' });
  }

  const teamNumber = Number(team);
  const seasonYear = Number(year);

  if (!Number.isInteger(teamNumber) || teamNumber <= 0) {
    return res.status(400).json({ error: 'team must be a positive integer' });
  }

  if (!Number.isInteger(seasonYear) || seasonYear < 1992 || seasonYear > 2100) {
    return res.status(400).json({ error: 'year must be a valid FRC season year' });
  }

  const teamKey = `frc${teamNumber}`;
  const targetUrl = `https://www.thebluealliance.com/api/v3/team/${teamKey}/matches/${seasonYear}/simple`;

  console.log('[api/tba/team_matches_year] request', {
    teamNumber,
    seasonYear,
    teamKey,
  });

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'X-TBA-Auth-Key': apiKey,
      },
    });

    if (!response.ok) {
      console.error('[api/tba/team_matches_year] upstream failed', {
        teamNumber,
        seasonYear,
        status: response.status,
      });
      return res.status(response.status).json({ error: `TBA request failed with status ${response.status}` });
    }

    const data = await response.json();
    console.log('[api/tba/team_matches_year] success', {
      teamNumber,
      seasonYear,
      matchCount: Array.isArray(data) ? data.length : 0,
    });

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch (error) {
    console.error('[api/tba/team_matches_year] exception', {
      teamNumber,
      seasonYear,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to fetch team matches from TBA' });
  }
}
