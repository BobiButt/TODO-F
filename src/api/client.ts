// ============================================================================
// FILE:       frontend/src/api/client.ts
// PURPOSE:    Core HTTP client wrapper using browser Fetch API.
//             Automatically attaches X-User-Id and X-Role headers from localStorage,
//             prepends the API base prefix (/api/v1), and unpacks FastAPI errors.
// HOW IT WORKS: Exports apiRequest<T>() helper function used by all feature API
//             modules. Unpacks JSON response payloads or returns void on 204 No Content.
// USED BY / DEPENDS ON: src/api/users.ts, src/api/tasks.ts, src/api/comments.ts,
//             src/api/admin.ts.
// KEY CONCEPTS: Fetch abstraction, header-based authentication, error parsing,
//             type-safe responses.
// ============================================================================

// Base API URL prefix.
// Priority: API_BASE_URL (build-time, injected by vite.config.ts) →
//           VITE_API_BASE_URL (build-time, exposed by Vite's envPrefix) →
//           "/api/v1" (relative — same origin, useful behind a proxy).
//
// NOTE: the property access must be written literally as
// `import.meta.env.API_BASE_URL`. A type cast such as
// `(import.meta.env as { API_BASE_URL?: string }).API_BASE_URL` breaks Vite's
// `define` replacement, because the replaced text no longer appears in the
// source — the variable would silently stay undefined in the bundle.
const BASE_URL =
  import.meta.env.API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "/api/v1";

// Module-level holder for the current JWT token (set by AuthContext on login).
let currentToken: string | null = null;

/**
 * Call this once from AuthContext to inject the current JWT token.
 */
export function setAuthToken(token: string | null) {
  currentToken = token;
}

/**
 * Dispatches an HTTP request with the JWT Bearer token.
 *
 * @template T - Expected JSON response shape.
 * @param {string} endpoint - API path (e.g. '/tasks' or '/users/1').
 * @param {RequestInit} [options={}] - Standard Fetch options (method, body, etc.).
 * @returns {Promise<T>} Parsed JSON response payload.
 * @throws {Error} Human-readable error message parsed from backend 4xx/5xx responses.
 */
export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Construct full URL by combining base prefix and endpoint.
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  // Prepare HTTP headers map.
  const headers = new Headers(options.headers || {});

  // Set default JSON Content-Type if not sending FormData.
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Inject JWT Bearer token on every outgoing request.
  if (currentToken) {
    headers.set("Authorization", `Bearer ${currentToken}`);
  }

  // Dispatch network request.
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle HTTP 204 No Content response.
  if (response.status === 204) {
    return null as unknown as T;
  }

  // Try to parse the error body once — FastAPI envelopes errors as { detail: ... }.
  let errorData: any = null;
  try {
    errorData = await response.json();
  } catch {
    // Non-JSON body — errorData stays null.
  }

  // Handle HTTP 403 Forbidden — email not verified.
  if (response.status === 403) {
    const detail = errorData && errorData.detail ? errorData.detail : null;
    // Protected-route 403: "Email not verified. Please verify your email to access the dashboard."
    if (typeof detail === "string" && detail.includes("not verified")) {
      setAuthToken(null);
      window.dispatchEvent(new CustomEvent("auth:email-not-verified"));
      throw new Error("EMAIL_NOT_VERIFIED");
    }
    // Login 403: { code: "email_not_verified", message, resend_otp, email }.
    if (detail && detail.code === "email_not_verified") {
      setAuthToken(null);
      window.dispatchEvent(new CustomEvent("auth:email-not-verified", { detail: { email: detail.email } }));
      throw new Error(
        JSON.stringify({
          code: "email_not_verified",
          message: detail.message,
          resend_otp: detail.resend_otp,
          email: detail.email,
        })
      );
    }
    // Any other 403 — surface the detail string or fall through.
    const msg = typeof detail === "string" ? detail : JSON.stringify(detail || {});
    throw new Error(msg || `HTTP 403: ${response.statusText}`);
  }

  // Handle 401 Unauthorized — token invalid or expired.
  if (response.status === 401) {
    // FIX: clear the stale token so the app drops back to unauthenticated
    // state and RoleContext stops re-fetching.
    setAuthToken(null);
    const detail = errorData && errorData.detail ? errorData.detail : null;
    const msg = typeof detail === "string" ? detail : "Session expired. Please log in again.";
    throw new Error(msg);
  }

  // Check if response indicates an error (status >= 400).
  if (!response.ok) {
    const detail = errorData && errorData.detail ? errorData.detail : null;
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    if (typeof detail === "string") {
      errorMessage = detail;
    } else if (Array.isArray(detail)) {
      // Join Pydantic validation error descriptions.
      errorMessage = detail.map((err: any) => err.msg || JSON.stringify(err)).join(", ");
    }
    // Throw error to be caught by React Query or caller.
    throw new Error(errorMessage);
  }

  // Parse and return JSON payload.
  if (errorData !== null) {
    return errorData as T;
  }
  return response.json() as T;
}

export async function apiDownload(endpoint: string): Promise<Blob> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const response = await fetch(`${BASE_URL}${cleanEndpoint}`, {
    headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Preserve the status message when the error is not JSON.
    }
    throw new Error(message);
  }
  return response.blob();
}
