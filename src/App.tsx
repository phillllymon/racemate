import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { TimeProvider } from "./TimeContext";
import { RaceProvider, useRaces } from "./RaceContext";
import LoginPage from "./LoginPage";
import TopBar from "./TopBar";
import TabBar from "./TabBar";
import RacesTab from "./RacesTab";
import StartTab from "./StartTab";
import ChartTab from "./ChartTab";
import FinishTab from "./FinishTab";
import ResultsTab from "./ResultsTab";
import type { TabId } from "./TabBar";

function MainApp() {
  const { selectedRace, synced } = useRaces();
  const [activeTab, setActiveTab] = useState<TabId>("races");

  return (
    <TimeProvider>
      <div className="app-shell">
        <TopBar
          raceName={selectedRace ? selectedRace.name : null}
          synced={synced}
        />

        <div className="app-body">
          <div className={`app-tab-pane ${activeTab === "races" ? "app-tab-pane--active" : ""}`}>
            <RacesTab />
          </div>
          <div className={`app-tab-pane ${activeTab === "start" ? "app-tab-pane--active" : ""}`}>
            <StartTab />
          </div>
          <div className={`app-tab-pane ${activeTab === "chart" ? "app-tab-pane--active" : ""}`}>
            <ChartTab />
          </div>
          <div className={`app-tab-pane ${activeTab === "finish" ? "app-tab-pane--active" : ""}`}>
            <FinishTab />
          </div>
          <div className={`app-tab-pane ${activeTab === "results" ? "app-tab-pane--active" : ""}`}>
            <ResultsTab />
          </div>
        </div>

        <TabBar active={activeTab} onChange={setActiveTab} />
      </div>
    </TimeProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <LoginPage />;

  return (
    <RaceProvider>
      <MainApp />
    </RaceProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
