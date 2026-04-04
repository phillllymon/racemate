import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "./AuthContext";
import ClubsModal from "./ClubsModal";

type Theme = "dark" | "light" | "highcontrast";

function getStoredTheme(): Theme {
  const stored = localStorage.getItem("racemate-theme");
  if (stored === "light" || stored === "highcontrast") return stored;
  return "dark";
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove("theme-light", "theme-highcontrast");
  if (theme === "light") html.classList.add("theme-light");
  else if (theme === "highcontrast") html.classList.add("theme-highcontrast");
  localStorage.setItem("racemate-theme", theme);
}

// Apply on load
applyTheme(getStoredTheme());

export default function TopBarMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clubsOpen, setClubsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [finishDisplay, setFinishDisplay] = useState<"clock" | "elapsed">(
    (localStorage.getItem("racemate-finish-display") as "clock" | "elapsed") || "clock"
  );
  const menuRef = useRef<HTMLDivElement>(null);

  const changeTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  const changeFinishDisplay = (mode: "clock" | "elapsed") => {
    setFinishDisplay(mode);
    localStorage.setItem("racemate-finish-display", mode);
    window.dispatchEvent(new Event("racemate-settings-changed"));
  };

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
            onClick={() => { setOpen(false); setSettingsOpen(true); }}
          >
            Settings
          </button>
          <button
            className="topbar-menu-item"
            onClick={() => { setOpen(false); setClubsOpen(true); }}
          >
            Clubs
          </button>
          <button
            className="topbar-menu-item topbar-menu-item--danger"
            onClick={() => { setOpen(false); logout(); }}
          >
            Sign Out
          </button>
        </div>
      )}

      {settingsOpen && createPortal(
        <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <span className="settings-title">Settings</span>
              <button className="settings-close" onClick={() => setSettingsOpen(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="settings-body">
              <div className="settings-section">
                <div className="settings-section-label">Appearance</div>
                <div className="settings-theme-options">
                  <button
                    className={`settings-theme-btn ${theme === "dark" ? "settings-theme-btn--active" : ""}`}
                    onClick={() => changeTheme("dark")}
                  >
                    <span className="settings-theme-preview settings-theme-preview--dark" />
                    <span>Dark</span>
                  </button>
                  <button
                    className={`settings-theme-btn ${theme === "light" ? "settings-theme-btn--active" : ""}`}
                    onClick={() => changeTheme("light")}
                  >
                    <span className="settings-theme-preview settings-theme-preview--light" />
                    <span>Light</span>
                  </button>
                  <button
                    className={`settings-theme-btn ${theme === "highcontrast" ? "settings-theme-btn--active" : ""}`}
                    onClick={() => changeTheme("highcontrast")}
                  >
                    <span className="settings-theme-preview settings-theme-preview--hc" />
                    <span>High Contrast</span>
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-label">Finish Time Display</div>
                <div className="start-mode-toggle">
                  <button
                    className={`start-mode-btn ${finishDisplay === "clock" ? "start-mode-btn--active" : ""}`}
                    onClick={() => changeFinishDisplay("clock")}
                  >
                    Clock Time
                  </button>
                  <button
                    className={`start-mode-btn ${finishDisplay === "elapsed" ? "start-mode-btn--active" : ""}`}
                    onClick={() => changeFinishDisplay("elapsed")}
                  >
                    Elapsed Time
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      <ClubsModal open={clubsOpen} onClose={() => setClubsOpen(false)} />
    </div>
  );
}
