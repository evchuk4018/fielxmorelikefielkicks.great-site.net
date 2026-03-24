import { createClient } from '@supabase/supabase-js';
import { euclideanDistance, normalizeEmbedding } from '../../lib/faceid-server-utils.js';

const DEFAULT_THRESHOLD = 0.55;

function toThreshold(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return DEFAULT_THRESHOLD;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const embedding = normalizeEmbedding(req.body?.embedding);
  if (!embedding) {
    return res.status(400).json({ error: 'A valid embedding array is required' });
  }

  const threshold = Math.max(0.2, Math.min(1.2, toThreshold(req.body?.threshold)));

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase server credentials are not configured' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('face_id_enrollments')
    .select('id, person_name, embedding')
    .order('updated_at', { ascending: false })
    .limit(5000);

  if (error) {
    return res.status(500).json({ error: error.message || 'Failed to verify face' });
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) {
    return res.status(200).json({
      matched: false,
      name: null,
      enrollmentId: null,
      distance: null,
      checked: 0,
    });
  }

  let best = {
    enrollmentId: null,
    name: null,
    distance: Number.POSITIVE_INFINITY,
  };

  for (const row of rows) {
    const candidate = normalizeEmbedding(row?.embedding);
    if (!candidate || candidate.length !== embedding.length) {
      continue;
    }

    const distance = euclideanDistance(embedding, candidate);
    if (distance < best.distance) {
      best = {
        enrollmentId: typeof row.id === 'string' ? row.id : null,
        name: typeof row.person_name === 'string' ? row.person_name : null,
        distance,
      };
    }
  }

  const matched = Number.isFinite(best.distance) && best.distance <= threshold;

  return res.status(200).json({
    matched,
    name: matched ? best.name : null,
    enrollmentId: matched ? best.enrollmentId : null,
    distance: Number.isFinite(best.distance) ? Number(best.distance.toFixed(6)) : null,
    checked: rows.length,
    threshold,
  });
}
