import { storage } from './storage';
import { supabase } from './supabase';

export const DEFAULT_FIELD_MAP_SRC = '/auton-field-overlay.svg';
export const FIELD_MAP_BUCKET = 'field-maps';
export const FIELD_MAP_MAX_FILE_SIZE = 8 * 1024 * 1024;

const FIELD_MAP_SETTING_ID = 'default';
const FIELD_MAP_CACHE_KEY = 'global:fieldMapSettings';

export type FieldMapSetting = {
  imageUrl: string;
  storagePath: string;
  updatedAt: number;
};

type FieldMapSettingRow = {
  id: string;
  image_url: string | null;
  storage_path: string | null;
  updated_at: string;
};

function mapRow(row: FieldMapSettingRow): FieldMapSetting | null {
  if (!row.image_url || !row.storage_path) {
    return null;
  }

  return {
    imageUrl: row.image_url,
    storagePath: row.storage_path,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function getFileExtension(fileName: string, contentType: string): string {
  const extension = fileName.split('.').pop()?.trim().toLowerCase();
  if (extension && /^[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  const typeExtension = contentType.split('/').pop()?.trim().toLowerCase();
  return typeExtension && /^[a-z0-9]+$/.test(typeExtension) ? typeExtension : 'bin';
}

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cacheSetting(setting: FieldMapSetting | null): void {
  storage.set(FIELD_MAP_CACHE_KEY, setting);
}

export function getCachedFieldMapSetting(): FieldMapSetting | null {
  const cached = storage.get<FieldMapSetting | null>(FIELD_MAP_CACHE_KEY);
  if (!cached || typeof cached.imageUrl !== 'string' || typeof cached.storagePath !== 'string') {
    return null;
  }

  return cached;
}

export function getFieldMapSrc(setting: FieldMapSetting | null): string {
  return setting?.imageUrl || DEFAULT_FIELD_MAP_SRC;
}

export async function loadFieldMapSetting(): Promise<FieldMapSetting | null> {
  const { data, error } = await supabase
    .from('field_map_settings')
    .select('id, image_url, storage_path, updated_at')
    .eq('id', FIELD_MAP_SETTING_ID)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load field map settings.');
  }

  const setting = data ? mapRow(data as FieldMapSettingRow) : null;
  cacheSetting(setting);
  return setting;
}

function validateFieldMapFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }

  if (file.size <= 0 || file.size > FIELD_MAP_MAX_FILE_SIZE) {
    throw new Error('The field map image must be smaller than 8 MiB.');
  }
}

async function removeUploadedAsset(path: string): Promise<void> {
  const { error } = await supabase.storage.from(FIELD_MAP_BUCKET).remove([path]);
  if (error) {
    console.warn('Failed to remove field map asset:', error.message);
  }
}

export async function uploadFieldMapImage(file: File): Promise<FieldMapSetting> {
  validateFieldMapFile(file);

  const previousSetting = await loadFieldMapSetting();
  const extension = getFileExtension(file.name, file.type);
  const path = `global/${Date.now()}-${randomSuffix()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(FIELD_MAP_BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: '31536000',
    contentType: file.type,
  });

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload the field map image.');
  }

  const { data: publicUrlData } = supabase.storage.from(FIELD_MAP_BUCKET).getPublicUrl(path);
  const imageUrl = publicUrlData?.publicUrl;
  if (!imageUrl) {
    await removeUploadedAsset(path);
    throw new Error('Failed to resolve the uploaded field map image URL.');
  }

  const { data, error: saveError } = await supabase
    .from('field_map_settings')
    .upsert(
      {
        id: FIELD_MAP_SETTING_ID,
        image_url: imageUrl,
        storage_path: path,
      },
      { onConflict: 'id' },
    )
    .select('id, image_url, storage_path, updated_at')
    .single();

  if (saveError || !data) {
    await removeUploadedAsset(path);
    throw new Error(saveError?.message || 'Failed to save the field map setting.');
  }

  const setting = mapRow(data as FieldMapSettingRow);
  if (!setting) {
    await removeUploadedAsset(path);
    throw new Error('The saved field map setting was incomplete.');
  }

  cacheSetting(setting);

  if (previousSetting?.storagePath && previousSetting.storagePath !== path) {
    await removeUploadedAsset(previousSetting.storagePath);
  }

  return setting;
}
