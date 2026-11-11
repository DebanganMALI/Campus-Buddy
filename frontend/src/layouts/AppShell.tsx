// The signed-in frame: sticky header with pill navigation (desktop), bottom tab bar (phones/tablets),
// profile menu, skip link and focus management on page change.
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/auth-context";
import { Icon, type IconName } from "../components/Icon";
import { BrandMark } from "../components/BrandMark";
import { initials, ROLE_LABEL } from "../lib/format";

const NAV: Array<{ to: string; label: string; short: string; icon: IconName }> = [
  { to: "/dashboard", label: "Home", short: "Home", icon: "home" },
  { to: "/announcements", label: "Announcements", short: "News", icon: "megaphone" },
  { to: "/events", label: "Events", short: "Events", icon: "calendar" },
  { to: "/resources", label: "Resources", short: "Resources", icon: "book" },
  { to: "/openings", label: "Opportunities", short: "Openings", icon: "briefcase" },
];

export function AppShell() {
  const location = useLocation();

  // After navigation: scroll to top and move focus to the page title, so keyboard and
  // screen-reader users land at the start of the new page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const id = requestAnimationFrame(() => document.getElementById("page-title")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/dashboard" className="brand" aria-label="Campus Companion home">
            <BrandMark />
            <span className="brand-name">
              Campus Companion<span>IEM</span>
            </span>
          </Link>
          <nav className="nav-pills" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="nav-pill">
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <Link to="/search" className="icon-btn" aria-label="Search">
              <Icon name="search" />
            </Link>
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main id="main" className="app-main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to}>
            <span className="tab-icon">
              <Icon name={n.icon} size={22} />
            </span>
            {n.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function ProfileMenu() {
  const { state, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (state.status !== "authenticated") return null;
  const { user } = state;

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" aria-hidden>
          {initials(user.name)}
        </span>
      </button>
      {open && (
        <div className="menu-panel">
          <div className="menu-head">
            <strong>{user.name}</strong>
            <span className="small muted">
              {ROLE_LABEL[user.role] ?? user.role}, {user.department}
              {user.year ? `, Year ${user.year}` : ""}
            </span>
          </div>
          <Link to="/me" className="menu-item">
            <Icon name="user" /> Profile
          </Link>
          <Link to="/bookmarks" className="menu-item">
            <Icon name="bookmark" /> Bookmarks
          </Link>
          {can("user:read") && (
            <Link to="/admin/users" className="menu-item">
              <Icon name="users" /> Manage users
            </Link>
          )}
          <button type="button" className="menu-item" onClick={() => void logout()}>
            <Icon name="logout" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
