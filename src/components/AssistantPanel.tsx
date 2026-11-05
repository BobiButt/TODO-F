import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Download, ImageIcon, LoaderCircle, Send, ShieldCheck, Sparkles, Trash2, UserRound, X } from "lucide-react";
import {
  AssistantDiagnostic,
  AssistantMessage,
  clearAssistantHistory,
  fetchAssistantHistory,
  sendAssistantMessage,
} from "@/api/assistant";
import { downloadImage, generateImage } from "@/api/image";
import { useTaskCache } from "@/context/TaskContext";
import { Role } from "@/types";

interface AssistantPanelProps {
  role: Role;
  name: string;
}

/** Chat message enriched with optional provider diagnostics and generated images. */
interface DisplayMessage extends AssistantMessage {
  diagnostics?: AssistantDiagnostic[];
  imageUrl?: string;
  imageBlob?: Blob;
  imagePrompt?: string;
}

const suggestions: Record<Role, string[]> = {
  user: ["Show my overdue tasks", "Create a task to plan my week", "Mark task 3 as complete"],
  admin: ["Give me a system summary", "Show all overdue tasks", "List the users"],
};

const CHAT_CACHE_KEY = "taskflow_chat_cache_v1";
const MAX_CACHE_MESSAGES = 120;

function loadChatCache(): DisplayMessage[] | null {
  try {
    const raw = localStorage.getItem(CHAT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content, diagnostics: m.diagnostics }));
  } catch {
    return null;
  }
}

function saveChatCache(messages: DisplayMessage[]) {
  try {
    const safe = messages.slice(-MAX_CACHE_MESSAGES).map((m) => ({
      role: m.role,
      content: m.content,
      diagnostics: m.diagnostics,
      // image blobs/URLs are not persisted in localStorage; DB stores task/chat text only
    }));
    localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(safe));
  } catch {
    // ignore quota/storage errors
  }
}

export function AssistantPanel({ role, name }: AssistantPanelProps) {
  const isAdmin = role === "admin";
  const defaultMessage: DisplayMessage = {
    role: "assistant",
    content: isAdmin
      ? `Hi ${name}. I can help review and manage TaskFlow across users, tasks, and system activity.`
      : `Hi ${name}. I can help organize and update your tasks. I only have access to your own workspace.`,
  };
  const [messages, setMessages] = useState<DisplayMessage[]>(() => loadChatCache() ?? [defaultMessage]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { notifyAssistantAction } = useTaskCache();

  const [imageMode, setImageMode] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatingImage, setGeneratingImage] = useState(false);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, imageMode, generatingImage]);

  useEffect(() => {
    saveChatCache(messages);
  }, [messages]);

  // Load persisted chat from DB (text conversation). Merges/replaces cache when available.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const history = await fetchAssistantHistory(120);
        if (!mounted || !history.length) return;
        setMessages(history.map((m) => ({ role: m.role, content: m.content })));
      } catch {
        // keep local cache/default if backend history unavailable
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  async function submitImagePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = imagePrompt.trim();
    if (!content || generatingImage) return;
    setError("");
    setMessages((current) => [...current, { role: "user", content: `🖼️ Generate image: ${content}` }]);
    setImagePrompt("");
    setGeneratingImage(true);
    try {
      const { url, blob } = await generateImage(content);
      objectUrlsRef.current.add(url);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `Generated image for: "${content}"`, imageUrl: url, imageBlob: blob, imagePrompt: content },
      ]);
      setImageMode(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Image generation failed.");
    } finally {
      setGeneratingImage(false);
    }
  }

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
      // Notify task cache to quietly update tasks in the background if the assistant executed actions
      notifyAssistantAction(response.actions);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not respond.");
    } finally {
      setSending(false);
    }
  }

  async function clearChat() {
    setMessages([defaultMessage]);
    setError("");
    try {
      await clearAssistantHistory();
    } catch {
      // local cleared; server clear best-effort
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
        <button type="button" className="assistant-icon-btn" aria-label="Clear chat history" title="Clear chat" onClick={() => void clearChat()} disabled={sending || generatingImage}>
          <Trash2 size={15} />
        </button>
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
              {message.imageUrl && (
                <>
                  <img
                    src={message.imageUrl}
                    alt="Generated from prompt"
                    className="assistant-generated-image"
                    loading="lazy"
                  />
                  {message.imageBlob && (
                    <div className="assistant-image-actions">
                      <button
                        type="button"
                        className="plain-button"
                        onClick={() => downloadImage(message.imageBlob!, `taskflow-${(message.imagePrompt || "image").slice(0, 24).replace(/[^a-z0-9]+/gi, "-")}.png`)}
                      >
                        <Download size={14} /> Download image
                      </button>
                    </div>
                  )}
                </>
              )}
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
        {generatingImage && <div className="assistant-thinking"><LoaderCircle size={15} className="spin" /> Generating image…</div>}
        <div ref={bottomRef} />
      </div>

      <div className="assistant-compose-area">
        {messages.length < 3 && !imageMode && (
          <div className="assistant-suggestions" aria-label="Suggested requests">
            {suggestions[role].map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}</button>
            ))}
          </div>
        )}
        {error && <p className="assistant-error" role="alert">{error}</p>}
        {imageMode ? (
          <form className="assistant-form assistant-image-form" onSubmit={submitImagePrompt}>
            <label className="sr-only" htmlFor="assistant-image-prompt">Image prompt</label>
            <textarea
              id="assistant-image-prompt"
              value={imagePrompt}
              onChange={(event) => setImagePrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Describe the image to generate…"
              maxLength={1000}
              rows={2}
              disabled={generatingImage}
            />
            <button
              type="button"
              className="assistant-icon-btn"
              aria-label="Cancel image mode"
              onClick={() => { setImageMode(false); setImagePrompt(""); }}
              disabled={generatingImage}
              title="Back to chat"
            >
              <X size={17} />
            </button>
            <button className="assistant-send" type="submit" aria-label="Generate image" disabled={!imagePrompt.trim() || generatingImage}>
              <Send size={17} />
            </button>
          </form>
        ) : (
          <form className="assistant-form" onSubmit={submitMessage}>
            <button
              type="button"
              className="assistant-icon-btn"
              aria-label="Generate image from prompt"
              onClick={() => { setImageMode(true); setError(""); }}
              disabled={sending}
              title="Generate image"
            >
              <ImageIcon size={17} />
            </button>
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
        )}
        <div className="assistant-footer">
          {imageMode
            ? "Image prompts are sent to Pollinations (free service). Generation may take up to a minute."
            : "Text chat is saved to your account and cached locally for fast retrieval. Images can be downloaded but are not stored in DB."}
        </div>
      </div>
    </section>
  );
}
