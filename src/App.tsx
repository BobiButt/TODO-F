import { useEffect, useState } from "react";
import { Bot, ClipboardList, Shield } from "lucide-react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AdminWorkspace } from "@/components/AdminWorkspace";
import { AssistantPanel } from "@/components/AssistantPanel";
import { TaskWorkspace } from "@/components/TaskWorkspace";
import { LoginPage, RegisterPage, OTPPage } from "@/pages/AuthPages";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/types";

type WorkspaceView = "tasks" | "assistant" | "admin";
type Role = "admin" | "user";

// Redirects to login if not authenticated.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">T<span className="logo-accent">askflow</span></div>
            <h1>Loading…</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-otp" element={<OTPPage />} />

        {/* Protected app routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/tasks" replace />} />
          <Route path="tasks" element={<AppView view="tasks" />} />
          <Route path="assistant" element={<AppView view="assistant" />} />
          <Route path="admin" element={<AppView view="admin" />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function AppShell() {
  const { currentUserId, currentRole, currentUser, users, switchUser } = useRole();
  const { user: authUser } = useAuth();
  const [view, setView] = useState<WorkspaceView>("tasks");
  const activeRole = currentUser?.role ?? currentRole;
  const isAdmin = activeRole === "admin";
  const effectiveUser = authUser || currentUser;

  useEffect(() => {
    if (!isAdmin && view === "admin") setView("tasks");
  }, [isAdmin, view]);

  return (
    <>
      <nav className="topbar" aria-label="Workspace">
        <div className="brand-nav">
          <a className="brand" href="/" aria-label="TaskFlow home"><span className="brand-glyph">T</span>taskflow</a>
          <span className="user-welcome">{effectiveUser?.name}</span>
        </div>
        <div className="workspace-switcher">
          <span>WORKSPACE IDENTITY</span>
          <select
            aria-label="Select user or administrator workspace"
            value={currentUserId}
            onChange={(event) => {
              const selected = users.find((user) => user.id === Number(event.target.value));
              if (selected) switchUser(selected);
            }}
          >
            {users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}
          </select>
        </div>
        <button className="topbar-signout" type="button" onClick={() => {
          localStorage.removeItem("taskflow_token");
          localStorage.removeItem("taskflow_user");
          window.location.reload();
        }}>
          Sign out
        </button>
      </nav>
      <div className="workspace-layout">
        <aside className="workspace-rail">
          <div className="rail-caption">CURRENT SPACE</div>
          <div className={`role-stamp ${activeRole}`}>
            <span className="role-dot" />
            <div><strong>{isAdmin ? "Administrator" : "Personal workspace"}</strong><small>{effectiveUser?.email ?? "Loading identity…"}</small></div>
          </div>
          <div className="rail-rule" />
          <p className="rail-note">{isAdmin
            ? "This assistant can review system-wide tasks and perform administrator actions."
            : "This assistant can only see and manage tasks owned by your account."}</p>
          <nav className="workspace-nav" aria-label="Main navigation">
            <button type="button" className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}><ClipboardList size={16} />Tasks</button>
            <button type="button" className={view === "assistant" ? "active" : ""} onClick={() => setView("assistant")}><Bot size={16} />Assistant</button>
            {isAdmin && <button type="button" className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}><Shield size={16} />Admin</button>}
          </nav>
          <div className="rail-bottom">TASKFLOW<br />ASSISTED WORKSPACE</div>
        </aside>
        <div className="chat-stage">
          <AppView
            view={view}
            currentUserId={currentUserId}
            users={users}
            isAdmin={isAdmin}
            activeRole={activeRole}
            effectiveUser={effectiveUser}
          />
        </div>
      </div>
    </>
  );
}

function AppView({
  view,
  currentUserId = 0,
  users = [],
  isAdmin = false,
  activeRole = "user",
  effectiveUser = null,
}: {
  view: WorkspaceView;
  currentUserId?: number;
  users?: User[];
  isAdmin?: boolean;
  activeRole?: Role;
  effectiveUser?: User | null;
}) {
  return (
    <>
      {view === "tasks" && <TaskWorkspace isAdmin={isAdmin} currentUserId={currentUserId} users={users} />}
      {view === "assistant" && <AssistantPanel role={activeRole} name={effectiveUser?.name ?? "there"} />}
      {view === "admin" && isAdmin && <AdminWorkspace currentUserId={currentUserId} users={users} onUsersChanged={() => Promise.resolve()} />}
    </>
  );
}
