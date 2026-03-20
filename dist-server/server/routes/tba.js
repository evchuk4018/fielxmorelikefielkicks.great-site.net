import express from 'express';
const router = express.Router();
async function fetchTBA(path) {
    const apiKey = process.env.TBA_API_KEY;
    if (!apiKey) {
        throw new Error('TBA_API_KEY is not configured on the server');
    }
    const response = await fetch(`https://www.thebluealliance.com/api/v3/${path}`, {
        headers: {
            'X-TBA-Auth-Key': apiKey,
        },
    });
    if (!response.ok) {
        throw new Error(`TBA request failed with status ${response.status}`);
    }
    return response.json();
}
router.get('/teams/:eventKey', async (req, res) => {
    try {
        const teams = await fetchTBA(`event/${req.params.eventKey}/teams/simple`);
        res.json(teams);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch teams from TBA';
        res.status(500).json({ error: message });
    }
});
router.get('/matches/:eventKey', async (req, res) => {
    try {
        const matches = await fetchTBA(`event/${req.params.eventKey}/matches/simple`);
        res.json(matches);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch matches from TBA';
        res.status(500).json({ error: message });
    }
});
export default router;
