import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../services/api';

interface SiteSettings { [key: string]: string }

interface SettingsContextValue {
  settings: SiteSettings;
  loadingSettings: boolean;
  refreshSettings: () => void;
  getSetting: (key: string, defaultValue?: string) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loadingSettings, setLoadingSettings] = useState(true);

  const refreshSettings = useCallback(() => {
    api.get<SiteSettings>('/settings')
      .then(r => setSettings(r.data))
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, []);

  useEffect(() => { refreshSettings(); }, [refreshSettings]);

  const getSetting = (key: string, defaultValue = '') => settings[key] || defaultValue;

  return (
    <SettingsContext.Provider value={{ settings, loadingSettings, refreshSettings, getSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
