
import React from 'react';
import { Screen } from '../types';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { MapIcon } from './icons/MapIcon';
import { PlayCircleIcon } from './icons/PlayCircleIcon';
import { SettingsIcon } from './icons/SettingsIcon';

interface BottomNavProps {
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
}

const navItems = [
  { screen: Screen.DailyReview, icon: CalendarIcon },
  { screen: Screen.Trips, icon: MapIcon },
  { screen: Screen.ActiveTrip, icon: PlayCircleIcon },
  { screen: Screen.Office, icon: BriefcaseIcon },
  { screen: Screen.Settings, icon: SettingsIcon },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeScreen, setActiveScreen }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-50 md:hidden">
      <div className="flex justify-around max-w-2xl mx-auto">
        {navItems.map(({ screen, icon: Icon }) => (
          <button
            key={screen}
            onClick={() => setActiveScreen(screen)}
            className={`flex flex-col items-center justify-center w-full pt-2 pb-1 text-xs sm:text-sm transition-colors duration-200 ${
              activeScreen === screen ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
            }`}
          >
            <Icon className="w-6 h-6 mb-1" />
            <span>{screen}</span>
          </button>
        ))}
      </div>
    </div>
  );
};