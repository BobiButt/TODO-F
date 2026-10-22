import { apiRequest } from "@/api/client";

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

export function sendAssistantMessage(messages: AssistantMessage[]): Promise<AssistantResponse> {
  return apiRequest<AssistantResponse>("/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}