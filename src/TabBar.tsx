export type TabId = "races" | "checkin" | "start" | "chart" | "finish" | "results";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "races", label: "Series" },
  { id: "checkin", label: "Check-In" },
  { id: "start", label: "Start" },
  { id: "chart", label: "Chart" },
  { id: "finish", label: "Finish" },
  { id: "results", label: "Results" },
];

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tabbar-tab ${active === tab.id ? "tabbar-tab--active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
