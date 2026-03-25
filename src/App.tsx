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
          {activeTab === "races" && <RacesTab />}
          {activeTab === "start" && <StartTab />}
          {activeTab === "chart" && <ChartTab />}
          {activeTab === "finish" && <FinishTab />}
          {activeTab === "results" && <ResultsTab />}
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
