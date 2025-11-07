
import React from 'react';
import { Screen } from '../types';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { MapIcon } from './icons/MapIcon';
import { PlayCircleIcon } from './icons/PlayCircleIcon';
import { SettingsIcon } from './icons/SettingsIcon';

interface SideNavProps {
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

export const SideNav: React.FC<SideNavProps> = ({ activeScreen, setActiveScreen }) => {
  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 h-screen sticky top-0">
      <div className="h-full flex flex-col p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 px-2">
            Field Service
        </h1>
        <nav className="flex-grow">
          <ul className="space-y-2">
            {navItems.map(({ screen, icon: Icon }) => (
              <li key={screen}>
                <button
                  onClick={() => setActiveScreen(screen)}
                  className={`flex items-center w-full px-3 py-2 text-left text-base font-medium rounded-lg transition-colors duration-200 ${
                    activeScreen === screen 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  aria-current={activeScreen === screen ? 'page' : undefined}
                >
                  <Icon className="w-6 h-6 mr-3" />
                  <span>{screen}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
};