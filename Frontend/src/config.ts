type AppConfig = {
  app: {
    name: string;
    subtitle: string;
  };
  api: {
    base_url: string;
  };
};

const DEFAULT_CONFIG: AppConfig = {
  app: {
    name: 'FullStack Template',
    subtitle: 'Fastify serves the React build and optional DB-backed API examples.',
  },
  api: {
    base_url: '',
  },
};

let cachedConfig: AppConfig | null = null;

const normalizeBaseUrl = (value: string | undefined | null): string => {
  const raw = (value || '').trim();
  if (!raw) {
    return '';
  }
  return raw.replace(/\/+$/, '');
};

const parseConfig = (raw: unknown): AppConfig => {
  const obj = raw as {
    app?: { name?: string; subtitle?: string };
    api?: { base_url?: string };
  };
  return {
    app: {
      name: String(obj?.app?.name || DEFAULT_CONFIG.app.name).trim() || DEFAULT_CONFIG.app.name,
      subtitle: String(obj?.app?.subtitle || DEFAULT_CONFIG.app.subtitle).trim() || DEFAULT_CONFIG.app.subtitle,
    },
    api: {
      base_url: normalizeBaseUrl(obj?.api?.base_url),
    },
  };
};

// The app waits for this before its first render, so it MUST give up quickly:
// without a timeout a stalled request left a blank page forever (OLS).
const CONFIG_TIMEOUT_MS = 3000;

const loadConfigFrom = async (path: string): Promise<AppConfig> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG_TIMEOUT_MS);
  try {
    const response = await fetch(path, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    const json = await response.json();
    return parseConfig(json);
  } finally {
    clearTimeout(timer);
  }
};

// Falls back to the built-in defaults. (The example file is no longer fetched:
// it lives outside public/ so it isn't served to every visitor.)
export const initAppConfig = async (): Promise<void> => {
  if (cachedConfig) {
    return;
  }

  try {
    cachedConfig = await loadConfigFrom('/config.json');
  } catch {
    cachedConfig = { ...DEFAULT_CONFIG };
  }
};

export const getAppConfig = (): AppConfig => {
  if (!cachedConfig) {
    return { ...DEFAULT_CONFIG };
  }
  return cachedConfig;
};

export const apiUrl = (path: string): string => {
  if (!path.startsWith('/')) {
    throw new Error(`apiUrl path must start with '/': ${path}`);
  }

  const configuredBaseUrl = getAppConfig().api.base_url;
  
  // If config has an explicit base_url, use it (for cross-origin scenarios)
  // Otherwise, use the current origin (same domain where frontend was served)
  const baseUrl = configuredBaseUrl || window.location.origin;
  
  return `${baseUrl}${path}`;
};
