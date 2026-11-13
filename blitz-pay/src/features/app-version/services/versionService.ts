import { config } from '../../../lib/config';
import { observability } from '../../../lib/observability';

export interface VersionInfo {
  appVersion: string | null;
  buildNumber: string | null;
  backendVersion: string | null;
  updateId: string | null;
  channel: string | null;
}

const TIMEOUT_MS = 5000;

/** Reads `build.version` from the public actuator info endpoint; resolves null on any failure. */
export async function fetchBackendVersion(): Promise<string | null> {
  const url = `${config.apiUrl.replace(/\/+$/, '')}/actuator/info`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      observability.warn('backend_version_failed', { status: response.status });
      return null;
    }
    const body = (await response.json()) as { build?: { version?: unknown } };
    const version = body?.build?.version;
    return typeof version === 'string' && version.trim() ? version.trim() : null;
  } catch (error) {
    observability.warn('backend_version_failed', { message: error instanceof Error ? error.message : String(error) });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function withV(version: string): string {
  return /^v/i.test(version) ? version : `v${version}`;
}

export function formatVersionLine(info: VersionInfo, unknown: string): string {
  const app = info.appVersion ? withV(info.appVersion) : unknown;
  const build = info.buildNumber ? ` (${info.buildNumber})` : '';
  const api = info.backendVersion ? withV(info.backendVersion) : unknown;
  return `App ${app}${build} · API ${api}`;
}

/** e.g. "Update 1a2b3c4d · production"; null when running the embedded bundle without a channel. */
export function formatUpdateLine(info: VersionInfo): string | null {
  const parts = [info.updateId ? `Update ${info.updateId.slice(0, 8)}` : null, info.channel].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
