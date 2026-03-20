import express from 'express';
import db from '../db.js';
const router = express.Router();
function normalizeJsonPayload(value) {
    if (typeof value === 'string') {
        return JSON.parse(value);
    }
    return value;
}
router.get('/', async (req, res) => {
    try {
        const [pitResult, matchResult] = await Promise.all([
            db.from('pit_scouts').select('id, data, updated_at'),
            db.from('match_scouts').select('id, data, updated_at'),
        ]);
        if (pitResult.error) {
            throw pitResult.error;
        }
        if (matchResult.error) {
            throw matchResult.error;
        }
        const pitScouts = pitResult.data ?? [];
        const matchScouts = matchResult.data ?? [];
        const formattedPitScouts = pitScouts.map((row) => ({
            id: row.id,
            type: 'pitScout',
            timestamp: new Date(row.updated_at).getTime(),
            data: normalizeJsonPayload(row.data),
        }));
        const formattedMatchScouts = matchScouts.map((row) => ({
            id: row.id,
            type: 'matchScout',
            timestamp: new Date(row.updated_at).getTime(),
            data: normalizeJsonPayload(row.data),
        }));
        res.json({
            pitScouts: formattedPitScouts,
            matchScouts: formattedMatchScouts,
        });
    }
    catch (error) {
        console.error('Data fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});
export default router;
