import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { fetchBackendVersion, type VersionInfo } from '../services/versionService';

// Guarded so an OTA update reaching a binary built without expo-application cannot crash the screen.
function nativeBuild(): { version: string | null; build: string | null } {
  try {
    const Application = require('expo-application') as typeof import('expo-application');
    return { version: Application.nativeApplicationVersion, build: Application.nativeBuildVersion };
  } catch {
    return { version: null, build: null };
  }
}

export function useVersionInfo(): VersionInfo {
  const [backendVersion, setBackendVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchBackendVersion().then((version) => {
      if (active) setBackendVersion(version);
    });
    return () => {
      active = false;
    };
  }, []);

  const native = nativeBuild();
  return {
    appVersion: Constants.expoConfig?.version ?? native.version,
    buildNumber: native.build,
    backendVersion,
    updateId: Updates.isEmbeddedLaunch ? null : Updates.updateId,
    channel: Updates.channel,
  };
}
