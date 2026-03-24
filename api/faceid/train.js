import { createClient } from '@supabase/supabase-js';
import { normalizeEmbedding, normalizePhotoUrls } from './_utils.js';

function createEnrollmentId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `face-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const personName = typeof req.body?.personName === 'string' ? req.body.personName.trim() : '';
  if (!personName) {
    return res.status(400).json({ error: 'personName is required' });
  }

  const embedding = normalizeEmbedding(req.body?.embedding);
  if (!embedding) {
    return res.status(400).json({ error: 'A valid embedding array is required' });
  }

  const photoUrls = normalizePhotoUrls(req.body?.photoUrls);
  const embeddingModel = typeof req.body?.embeddingModel === 'string' && req.body.embeddingModel.trim() !== ''
    ? req.body.embeddingModel.trim()
    : 'face-api.js@tiny-face-detector-v1';

  const eventKey = typeof req.body?.eventKey === 'string' && req.body.eventKey.trim() !== ''
    ? req.body.eventKey.trim().toLowerCase()
    : null;

  const profileId = typeof req.body?.profileId === 'string' && req.body.profileId.trim() !== ''
    ? req.body.profileId.trim()
    : null;

  const qualityScore = typeof req.body?.qualityScore === 'number' && Number.isFinite(req.body.qualityScore)
    ? req.body.qualityScore
    : null;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase server credentials are not configured' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const row = {
    id: createEnrollmentId(),
    person_name: personName,
    event_key: eventKey,
    profile_id: profileId,
    embedding,
    embedding_model: embeddingModel,
    quality_score: qualityScore,
    photo_urls: photoUrls,
    metadata: {
      acceptedFrames: typeof req.body?.acceptedFrames === 'number' ? req.body.acceptedFrames : null,
    },
  };

  const { error } = await supabase.from('face_id_enrollments').insert(row);
  if (error) {
    return res.status(500).json({ error: error.message || 'Failed to save face enrollment' });
  }

  return res.status(200).json({
    id: row.id,
    personName: row.person_name,
    photoCount: photoUrls.length,
    embeddingModel: row.embedding_model,
  });
}
