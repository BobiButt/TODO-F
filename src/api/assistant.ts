import { apiRequest } from "@/api/client";
import { toast } from "sonner";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

/** One classified attempt (success or failure) against an AI provider. */
export interface AssistantDiagnostic {
  provider: string;
  model?: string | null;
  phase?: string | null;
  ok: boolean;
  /** Stable failure kind: rate_limited, quota_exceeded, auth_error,
   *  model_not_found, invalid_request, server_error, timeout,
   *  connection_error, invalid_response, ... ("ok" for successes). */
  category: string;
  http_status?: number | null;
  detail: string;
  elapsed_ms?: number | null;
}

export interface AssistantResponse {
  reply: string;
  provider: "openrouter" | "gemini" | "groq" | "local" | string;
  actions: { name: string; ok: boolean; result?: unknown; error?: string }[];
  diagnostics?: AssistantDiagnostic[];
}

/** Max time (ms) to wait for the assistant before aborting. Vercel functions die at 10s. */
const ASSISTANT_TIMEOUT_MS = 9000;

export function sendAssistantMessage(messages: AssistantMessage[]): Promise<AssistantResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);

  const promise = apiRequest<AssistantResponse>("/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
    signal: controller.signal,
  });

  // Clear the timeout once the request settles (success or failure).
  const settled = promise.finally(() => clearTimeout(timeoutId));

  settled.catch((error) => {
    if (error instanceof Error && error.name === "AbortError") {
      toast.error("AI is taking too long to respond. Please try a shorter prompt.");
    }
  });

  return settled;
}