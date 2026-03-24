function toFiniteNumberArray(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const values = value
    .map((entry) => (typeof entry === 'number' ? entry : Number(entry)))
    .filter((entry) => Number.isFinite(entry));

  if (values.length !== value.length) {
    return null;
  }

  return values;
}

function l2Norm(vector) {
  const sum = vector.reduce((acc, value) => acc + value * value, 0);
  return Math.sqrt(sum);
}

export function normalizeEmbedding(embedding) {
  const values = toFiniteNumberArray(embedding);
  if (!values || values.length < 64 || values.length > 1024) {
    return null;
  }

  const norm = l2Norm(values);
  if (!Number.isFinite(norm) || norm <= 0) {
    return null;
  }

  return values.map((value) => value / norm);
}

export function euclideanDistance(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return Number.POSITIVE_INFINITY;
  }

  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    const delta = left[index] - right[index];
    total += delta * delta;
  }

  return Math.sqrt(total);
}

export function normalizePhotoUrls(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
