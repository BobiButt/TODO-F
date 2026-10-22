import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, Send, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { AssistantDiagnostic, AssistantMessage, sendAssistantMessage } from "@/api/assistant";
import { Role } from "@/types";

interface AssistantPanelProps {
  role: Role;
  name: string;
}

/** Chat message enriched with optional provider diagnostics for display. */
interface DisplayMessage extends AssistantMessage {
  diagnostics?: AssistantDiagnostic[];
}

const suggestions: Record<Role, string[]> = {
  user: ["Show my overdue tasks", "Create a task to plan my week", "Mark task 3 as complete"],
  admin: ["Give me a system summary", "Show all overdue tasks", "List the users"],
};

export function AssistantPanel({ role, name }: AssistantPanelProps) {
  const isAdmin = role === "admin";
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      role: "assistant",
      content: isAdmin
        ? `Hi ${name}. I can help review and manage TaskFlow across users, tasks, and system activity.`
        : `Hi ${name}. I can help organize and update your tasks. I only have access to your own workspace.`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    setError("");
    setSending(true);
    try {
      const response = await sendAssistantMessage(next.slice(-12));
      setMessages((current) => [
        ...current,
        { role: "assistant", content: response.reply, diagnostics: response.diagnostics },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not respond.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="assistant-panel" aria-label={`${role} assistant chat`}>
      <header className={`assistant-header ${isAdmin ? "assistant-admin" : "assistant-user"}`}>
        <div className="assistant-mark"><Sparkles size={18} aria-hidden="true" /></div>
        <div className="assistant-heading">
          <span className="assistant-kicker">TASKFLOW / {isAdmin ? "ADMIN DESK" : "PERSONAL DESK"}</span>
          <h1>{isAdmin ? "Admin assistant" : "Task assistant"}</h1>
        </div>
        <span className="assistant-scope">
          {isAdmin ? <ShieldCheck size={14} /> : <UserRound size={14} />}
          {isAdmin ? "System scope" : "Your tasks only"}
        </span>
      </header>

      <div className="assistant-conversation" aria-live="polite">
        <div className="assistant-date">YOUR TASKFLOW WORKSPACE</div>
        {messages.map((message, index) => (
          <article className={`assistant-message ${message.role}`} key={`${index}-${message.role}`}>
            <span className="message-avatar" aria-hidden="true">
              {message.role === "assistant" ? <Bot size={17} /> : <UserRound size={16} />}
            </span>
            <div className="message-content">
              <span className="message-author">{message.role === "assistant" ? (isAdmin ? "ADMIN ASSISTANT" : "TASK ASSISTANT") : name.toUpperCase()}</span>
              <p>{message.content}</p>
              {message.diagnostics && message.diagnostics.length > 0 && (
                <details className="assistant-diagnostics">
                  <summary>
                    {message.diagnostics.some((entry) => !entry.ok)
                      ? `Provider log — ${message.diagnostics.filter((entry) => !entry.ok).length} failed attempt(s)`
                      : `Provider log — ${message.diagnostics.map((entry) => entry.provider).join(" → ")}`}
                  </summary>
                  <ul>
                    {message.diagnostics.map((entry, entryIndex) => (
                      <li key={`${entry.provider}-${entryIndex}`} className={entry.ok ? undefined : "diag-fail"}>
                        <strong>{entry.provider}</strong>
                        {entry.ok
                          ? " ✓"
                          : ` — ${entry.category}${entry.http_status ? ` (HTTP ${entry.http_status})` : ""}`}
                        {entry.elapsed_ms != null ? ` · ${entry.elapsed_ms}ms` : ""}
                        {!entry.ok && `: ${entry.detail}`}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </article>
        ))}
        {sending && <div className="assistant-thinking"><LoaderCircle size={15} className="spin" /> Checking your workspace…</div>}
        <div ref={bottomRef} />
      </div>

      <div className="assistant-compose-area">
        {messages.length < 3 && (
          <div className="assistant-suggestions" aria-label="Suggested requests">
            {suggestions[role].map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}</button>
            ))}
          </div>
        )}
        {error && <p className="assistant-error" role="alert">{error}</p>}
        <form className="assistant-form" onSubmit={submitMessage}>
          <label className="sr-only" htmlFor="assistant-message">Message the assistant</label>
          <textarea
            id="assistant-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={isAdmin ? "Ask about users, tasks, or system status…" : "Ask about your tasks…"}
            maxLength={4000}
            rows={2}
            disabled={sending}
          />
          <button className="assistant-send" type="submit" aria-label="Send message" disabled={!draft.trim() || sending}>
            <Send size={17} />
          </button>
        </form>
        <div className="assistant-footer">Messages go to the configured AI provider. Actions stay within TaskFlow and your current role.</div>
      </div>
    </section>
  );
}