import { useEffect } from "react";
import { useAuth } from "../auth/auth-context";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  faculty: "Faculty",
  admin: "Admin",
  moderator: "Moderator",
  placement_officer: "Placement officer",
};

// Placeholder: part 2 adds announcements and upcoming events here
export function DashboardPage() {
  const { state, logout } = useAuth();

  useEffect(() => {
    document.title = "Dashboard · Campus Companion";
  }, []);

  if (state.status !== "authenticated") return null;
  const { user } = state;

  return (
    <div className="page">
      <header className="topbar">
        <span className="eyebrow">Campus Companion</span>
        <button type="button" className="btn" onClick={() => void logout()}>
          Log out
        </button>
      </header>
      <main>
        <p className="eyebrow">
          {ROLE_LABEL[user.role] ?? user.role} · {user.department}
          {user.year ? ` · Year ${user.year}` : ""}
        </p>
        <h1>Hello, {user.name}</h1>
        <p className="muted">Announcements and upcoming events will appear here (part 2).</p>
      </main>
    </div>
  );
}
