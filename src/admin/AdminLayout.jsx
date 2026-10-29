import { ChevronRight, LogOut, Menu } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Button } from "../components/ui";
import { useAuth } from "../lib/auth-context";
import { useApi } from "../lib/useApi";
import { NAV, navCounts } from "./nav";

function NavGroup({ item, open, onToggle, counts, onNavigate }) {
  const { pathname } = useLocation();
  const active = pathname.startsWith(item.base);
  const Icon = item.icon;
  const listId = `nav-${item.id}`;
  const waiting = item.children.reduce((sum, child) => sum + (child.count ? counts[child.count] || 0 : 0), 0);
  return (
    <div className={`nav-group ${active ? "has-active" : ""}`}>
      <button type="button" className="nav-group__toggle" aria-expanded={open} aria-controls={listId} onClick={onToggle}>
        <Icon aria-hidden="true" />
        {item.label}
        {!open && waiting > 0 && (
          <span className="nav-link__count" aria-label={`${waiting} waiting`}>
            {waiting}
          </span>
        )}
        <ChevronRight className="chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul className="nav-sub" id={listId}>
          {item.children.map((child) => (
            <li key={child.to}>
              <NavLink to={child.to} className="nav-link" onClick={onNavigate}>
                {child.label}
                {child.count && counts[child.count] > 0 && (
                  <span className="nav-link__count" aria-label={`${counts[child.count]} waiting`}>
                    {counts[child.count]}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Each program has its own page tint so staff always know which area they're in.
function sectionClass(pathname) {
  if (pathname.startsWith("/admin/pre-incubation")) return "admin--preincubation";
  if (pathname.startsWith("/admin/incubation")) return "admin--incubation";
  return "";
}

export function AdminLayout() {
  const { session, logout } = useAuth();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [manualGroups, setManualGroups] = useState({});
  const summary = useApi("/api/admin/dashboard");
  const counts = navCounts(summary.data);
  const refreshCounts = summary.reload;

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <div className={`admin ${sectionClass(pathname)} ${navOpen ? "nav-open" : ""}`}>
      <a href="#admin-main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Staff navigation">
        <NavLink to="/admin" className="sidebar__brand" onClick={closeNav}>
          <span className="sidebar__logo">
            <img src="/aic-logo.png" alt="" width="32" height="32" />
          </span>
          <span>
            <span className="sidebar__title">AIC MUJ</span>
            <span className="sidebar__subtitle" style={{ display: "block" }}>
              Staff workspace
            </span>
          </span>
        </NavLink>
        <nav className="sidebar__nav">
          {NAV.map((item, index) => {
            if (item.type === "section") {
              return (
                <div key={`section-${index}`} className="nav-section">
                  {item.label}
                </div>
              );
            }
            if (item.type === "link") {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.end} className="nav-link" onClick={closeNav}>
                  <Icon aria-hidden="true" />
                  {item.label}
                </NavLink>
              );
            }
            const open = manualGroups[item.id] ?? pathname.startsWith(item.base);
            return (
              <NavGroup
                key={item.id}
                item={item}
                open={open}
                counts={counts}
                onNavigate={closeNav}
                onToggle={() => setManualGroups((prev) => ({ ...prev, [item.id]: !open }))}
              />
            );
          })}
        </nav>
        <div className="sidebar__footer">
          <div className="sidebar__user">
            <strong>{session?.username}</strong>
            <span>Signed in</span>
          </div>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>
            Sign out
          </Button>
        </div>
      </aside>
      <div className="sidebar-scrim" onClick={closeNav} aria-hidden="true" />

      <div className="admin-main">
        <div className="admin-topbar">
          <Button variant="ghost" iconOnly icon={Menu} onClick={() => setNavOpen(true)} aria-expanded={navOpen}>
            Open navigation
          </Button>
          <span className="admin-topbar__title">AIC MUJ Staff</span>
        </div>
        <main id="admin-main" className="admin-content" tabIndex={-1}>
          <ErrorBoundary resetKey={pathname}>
            <Outlet context={{ summary: summary.data, refreshCounts }} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
