// ============================================================================
// FILE:       frontend-test/src/vite-env.d.ts
// PURPOSE:    TypeScript type declarations for the Vite client environment.
//             Types the custom variables that the app reads at build time.
// HOW IT WORKS: `/// <reference types="vite/client" />` pulls in Vite's own
//             ambient types; the interfaces below add the project specific
//             variables so `import.meta.env.API_BASE_URL` is type checked
//             instead of being `any`.
// USED BY / DEPENDS ON: TypeScript compiler.
// KEY CONCEPTS: Ambient declarations, import.meta.env typing.
// ============================================================================

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the backend API, e.g. "https://api.example.com/api/v1". */
  readonly API_BASE_URL?: string;
  /** Alternative spelling, natively exposed by Vite's `envPrefix`. */
  readonly VITE_API_BASE_URL?: string;
  /** Target used by the dev/preview proxy to reach a local backend. */
  readonly VITE_DEV_API_TARGET?: string;
  /** Google OAuth client ID for "Sign in with Google" (Google Cloud Console). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Vite build mode ("development" | "production"). */
  readonly VITE_APP_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: Record<string, unknown>) => void;
        renderButton: (
          element: HTMLElement,
          options: Record<string, unknown>,
        ) => void;
        prompt: () => void;
      };
    };
  };
}
