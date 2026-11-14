import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { CVList } from "@/components/cv-builder/CVList";
import { CVBuilderPage } from "@/components/cv-builder/CVBuilderPage";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { TrackerPage } from "@/components/tracker/TrackerPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { ImportPage } from "@/components/import/ImportPage";
import { HelpPage } from "@/components/help/HelpPage";
import { useSessionStore } from "@/stores/sessionStore";
import PrintView from "@/pages/PrintView";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import "./App.css";

/** Wrap Layout around non-print routes only — /print renders standalone. */
function AppRoutes() {
  const location = useLocation();
  const { isInitialized, error, initialize } = useSessionStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!isInitialized) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Chargement…</p></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Impossible d'ouvrir vos données</h1>
          <p className="text-sm text-gray-500 mb-4">Fermez puis relancez l'application. Si le problème continue, consultez la page Aide.</p>
          <p className="text-xs text-gray-400 break-words">{error}</p>
        </div>
      </div>
    );
  }

  // /print route: render outside Layout (no sidebar, no scroll container)
  if (location.pathname === '/print') {
    return <PrintView />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/cv" element={<CVList />} />
        <Route path="/cv/:id" element={<CVBuilderPage />} />
        <Route path="/tracker" element={<TrackerPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/aide" element={<HelpPage />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontFamily: 'var(--font-body)', fontSize: '13px' },
          }}
        />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
