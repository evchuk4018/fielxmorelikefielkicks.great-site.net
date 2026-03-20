import express from 'express';
import db from '../db.js';
const router = express.Router();
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isScoutRecord(value) {
    if (!isObject(value)) {
        return false;
    }
    return (typeof value.id === 'string' &&
        (value.type === 'pitScout' || value.type === 'matchScout') &&
        typeof value.timestamp === 'number' &&
        Number.isFinite(value.timestamp) &&
        isObject(value.data));
}
function toNullableNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
router.post('/', async (req, res) => {
    const records = req.body;
    if (!Array.isArray(records)) {
        return res.status(400).json({ success: false, error: 'Expected an array of records' });
    }
    if (!records.every(isScoutRecord)) {
        return res.status(400).json({ success: false, error: 'Invalid record payload format' });
    }
    const pitRows = [];
    const matchRows = [];
    try {
        for (const record of records) {
            const updatedAt = new Date(record.timestamp);
            if (Number.isNaN(updatedAt.getTime())) {
                return res.status(400).json({ success: false, error: `Invalid timestamp for record ${record.id}` });
            }
            if (record.type === 'pitScout') {
                pitRows.push({
                    id: record.id,
                    team_number: toNullableNumber(record.data.teamNumber),
                    data: record.data,
                    updated_at: updatedAt.toISOString(),
                });
                continue;
            }
            matchRows.push({
                id: record.id,
                match_number: toNullableNumber(record.data.matchNumber),
                team_number: toNullableNumber(record.data.teamNumber),
                alliance: typeof record.data.allianceColor === 'string' && record.data.allianceColor ? record.data.allianceColor : null,
                data: record.data,
                updated_at: updatedAt.toISOString(),
            });
        }
        const [pitResult, matchResult] = await Promise.all([
            pitRows.length > 0
                ? db.from('pit_scouts').upsert(pitRows, { onConflict: 'id' })
                : Promise.resolve({ error: null }),
            matchRows.length > 0
                ? db.from('match_scouts').upsert(matchRows, { onConflict: 'id' })
                : Promise.resolve({ error: null }),
        ]);
        if (pitResult.error) {
            throw pitResult.error;
        }
        if (matchResult.error) {
            throw matchResult.error;
        }
        res.json({ success: true, count: pitRows.length + matchRows.length });
    }
    catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ success: false, error: 'Internal server error during sync' });
    }
});
export default router;
