import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_FIELD_MAP_SRC,
  FieldMapSetting,
  getCachedFieldMapSetting,
  getFieldMapSrc,
  loadFieldMapSetting,
  uploadFieldMapImage,
} from '../../lib/fieldMap';

type FieldMapContextValue = {
  imageSrc: string;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  uploadImage: (file: File) => Promise<boolean>;
};

const defaultContextValue: FieldMapContextValue = {
  imageSrc: DEFAULT_FIELD_MAP_SRC,
  isLoading: false,
  isUploading: false,
  error: null,
  uploadImage: async () => false,
};

const FieldMapContext = createContext<FieldMapContextValue>(defaultContextValue);

type FieldMapProviderProps = {
  isAdminSignedIn: boolean;
  children: React.ReactNode;
};

export function FieldMapProvider({ isAdminSignedIn, children }: FieldMapProviderProps) {
  const [setting, setSetting] = useState<FieldMapSetting | null>(() => getCachedFieldMapSetting());
  const [isLoading, setIsLoading] = useState(() => !getCachedFieldMapSetting());
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const remoteSetting = await loadFieldMapSetting();
        if (!cancelled) {
          setSetting(remoteSetting);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the field map setting.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const uploadImage = useCallback(async (file: File): Promise<boolean> => {
    if (!isAdminSignedIn) {
      setError('Only admins can change the field map.');
      return false;
    }

    setIsUploading(true);
    setError(null);

    try {
      const nextSetting = await uploadFieldMapImage(file);
      setSetting(nextSetting);
      return true;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload the field map image.');
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [isAdminSignedIn]);

  const value = useMemo<FieldMapContextValue>(() => ({
    imageSrc: getFieldMapSrc(setting),
    isLoading,
    isUploading,
    error,
    uploadImage,
  }), [error, isLoading, isUploading, setting, uploadImage]);

  return <FieldMapContext.Provider value={value}>{children}</FieldMapContext.Provider>;
}

export function useFieldMap(): FieldMapContextValue {
  return useContext(FieldMapContext);
}
