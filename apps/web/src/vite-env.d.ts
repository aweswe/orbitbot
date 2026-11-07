/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_UI_LOCALE?: string;
  /** Build id (`YYYYMMDDHHMMSS`) of a production build; empty on the dev server. */
  readonly RAKAZO_BUILD?: string;
  /** Public Orion platform URL; the account-menu link is hidden when unset. */
  readonly VITE_ORION_PLATFORM_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.po" {
  export const messages: Record<string, unknown>;
}
