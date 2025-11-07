

import React, { useState, useEffect } from 'react';
import { Screen } from './types';
import { BottomNav } from './components/BottomNav';
import { SideNav } from './components/SideNav';
import DailyReviewScreen from './screens/DailyReviewScreen';
import TripsScreen from './screens/TripsScreen';
import ActiveTripScreen from './screens/ActiveTripScreen';
import OfficeScreen from './screens/OfficeScreen';
import SettingsScreen from './screens/SettingsScreen';
import { AppProvider, useAppContext } from './context/AppContext';
import { PrintPreviewScreen } from './components/PrintPreviewScreen';

const AppContent: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<Screen>(Screen.DailyReview);
  const { state, isLoading, setEditingTarget } = useAppContext();

  useEffect(() => {
    if (state.editingTarget) {
      setActiveScreen(Screen.Settings);
    }
  }, [state.editingTarget]);
  
  // Navigate to Active Trip screen if a trip becomes active
  useEffect(() => {
    const hasActiveTrip = state.trips.some(t => t.status === 'Active');
    if (hasActiveTrip && activeScreen !== Screen.ActiveTrip) {
      setActiveScreen(Screen.ActiveTrip);
    }
  }, [state.trips, activeScreen]);
  
  // Add/remove body class for print preview mode
  useEffect(() => {
    if (state.printRequest) {
      document.body.classList.add('print-preview-active');
    } else {
      document.body.classList.remove('print-preview-active');
    }
    // Cleanup on unmount or when printRequest changes
    return () => {
      document.body.classList.remove('print-preview-active');
    };
  }, [state.printRequest]);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="text-center">
                <p className="text-xl font-semibold text-gray-700">Loading Application Data...</p>
                <p className="text-gray-500">Please wait a moment.</p>
            </div>
        </div>
    );
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case Screen.DailyReview:
        return <DailyReviewScreen />;
      case Screen.Trips:
        return <TripsScreen setActiveScreen={setActiveScreen} />;
      case Screen.ActiveTrip:
        return <ActiveTripScreen />;
      case Screen.Office:
        return <OfficeScreen />;
      case Screen.Settings:
        return <SettingsScreen />;
      default:
        return <DailyReviewScreen />;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-100 font-sans text-gray-800 md:flex">
          {/* --- Side Navigation for Desktop --- */}
          <div className="hidden md:flex md:flex-shrink-0">
            <SideNav activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
          </div>

          {/* --- Main Content Area --- */}
          <div className="flex-grow">
              <main className="pb-20 md:pb-6 max-w-7xl mx-auto w-full">
                  <div className="p-4 sm:p-6">
                      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{activeScreen}</h1>
                      {renderScreen()}
                  </div>
              </main>
          </div>

          {/* --- Bottom Navigation for Mobile --- */}
          <BottomNav activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
      </div>

      {state.printRequest && (
        <PrintPreviewScreen printRequest={state.printRequest} />
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
