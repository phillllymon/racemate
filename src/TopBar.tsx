import { useTime } from "./TimeContext";
import FullscreenButton from "./FullscreenButton";
import TopBarMenu from "./TopBarMenu";

interface TopBarProps {
  raceName: string | null;
  synced: boolean;
}

export default function TopBar({ raceName, synced }: TopBarProps) {
  const { formatted } = useTime();

  return (
    <div className="topbar">
      <div className="topbar-left">
        <TopBarMenu />
        <span className="topbar-clock">{formatted}</span>
      </div>

      <div className="topbar-center">
        <span className="topbar-race">
          {raceName || "No race selected"}
        </span>
      </div>

      <div className="topbar-right">
        <span
          className={`topbar-sync ${synced ? "topbar-sync--ok" : "topbar-sync--pending"}`}
          title={synced ? "Synced" : "Syncing..."}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {synced ? (
              <polyline points="20 6 9 17 4 12" />
            ) : (
              <>
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </>
            )}
          </svg>
        </span>
        <FullscreenButton />
      </div>
    </div>
  );
}
