import { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";

export default function TopBarMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="topbar-menu-wrapper" ref={menuRef}>
      <button
        className="topbar-menu-trigger"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="topbar-menu-dropdown">
          {user && (
            <div className="topbar-menu-user">{user.name}</div>
          )}
          <button
            className="topbar-menu-item"
            onClick={() => { setOpen(false); logout(); }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
