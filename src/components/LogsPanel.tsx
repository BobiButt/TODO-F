import { useEffect, useState } from "react";
import { toast } from "sonner";
import { clearLogs, deleteLog, fetchLogs } from "@/api/logs";
import { ActivityLog } from "@/types";
import { Trash2 } from "lucide-react";

const LOGS_CACHE_KEY = "taskflow_logs_cache_v1";

function cacheKey(allUsers: boolean) {
  return `${LOGS_CACHE_KEY}:${allUsers ? "all" : "mine"}`;
}

function readCache(allUsers: boolean): ActivityLog[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(allUsers));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(allUsers: boolean, items: ActivityLog[]) {
  try {
    localStorage.setItem(cacheKey(allUsers), JSON.stringify(items.slice(0, 200)));
  } catch {
    // ignore
  }
}

export function LogsPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState(false);

  async function load(force = false) {
    const scopeAll = isAdmin && allUsers;
    if (!force) {
      const cached = readCache(scopeAll);
      if (cached) {
        setLogs(cached);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    try {
      const page = await fetchLogs({ page: 1, page_size: 100, all_users: scopeAll });
      setLogs(page.items);
      writeCache(scopeAll, page.items);
    } catch (error) {
      // keep cached view if refresh fails
      if (!logs.length) {
        const cached = readCache(scopeAll);
        if (cached) setLogs(cached);
      }
      toast.error(error instanceof Error ? error.message : "Could not load logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(false); }, [allUsers, isAdmin]);

  async function remove(id: number) {
    try {
      await deleteLog(id);
      setLogs((cur) => {
        const next = cur.filter((l) => l.id !== id);
        writeCache(isAdmin && allUsers, next);
        return next;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete log.");
    }
  }

  async function clear() {
    if (!window.confirm("Delete logs shown in this scope?")) return;
    try {
      await clearLogs(isAdmin && allUsers);
      setLogs([]);
      writeCache(isAdmin && allUsers, []);
      toast.success("Logs cleared.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not clear logs.");
    }
  }

  return (
    <section className="admin-workspace" aria-label="Logs">
      <div className="admin-content">
        <div className="workspace-page-heading">
          <div><span className="assistant-kicker">AUDIT & ERRORS</span><h2>Logs <small>{logs.length}</small></h2></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isAdmin && (
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                <input type="checkbox" checked={allUsers} onChange={(e) => setAllUsers(e.target.checked)} /> All users
              </label>
            )}
            <button className="plain-button" type="button" onClick={() => void load(true)} disabled={loading}>Refresh</button>
            <button className="plain-button" type="button" onClick={() => void clear()} disabled={loading || !logs.length}>Clear</button>
          </div>
        </div>
        {loading && !logs.length ? <div className="workspace-empty">Loading logs…</div> : (
          <div className="activity-list">
            {logs.map((item) => (
              <article className="activity-row" key={item.id}>
                <span className={item.action === "failed" ? "diag-fail" : undefined}>{item.action}</span>
                <div>
                  <strong>{item.actor_name}</strong>
                  <p>{item.entity_type}{item.entity_id ? ` #${item.entity_id}` : ""} · {JSON.stringify(item.detail)}</p>
                </div>
                <time>{new Date(item.created_at).toLocaleString()}</time>
                <button className="icon-control danger-control" aria-label="Delete log" title="Delete log" onClick={() => void remove(item.id)}><Trash2 size={14} /></button>
              </article>
            ))}
            {!logs.length && <div className="workspace-empty">No logs yet. Task actions and chat/task failures will appear here (after DB migration).</div>}
          </div>
        )}
      </div>
    </section>
  );
}
