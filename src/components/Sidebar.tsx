import React, { useState } from 'react';
import { useStore } from '../store';
import { ChevronDown, Trash2, Save } from 'lucide-react';

export function Sidebar() {
  const { 
    supportedApps, 
    selectedApp, 
    setApp,
    activeCategory,
    setCategory,
    saveProfile,
    loadProfile,
    deleteProfile,
    profiles,
    activeView,
    setView
  } = useStore();
  
  const [profileName, setProfileName] = useState('');

  const handleSaveProfile = () => {
    if (profileName.trim()) {
      saveProfile(profileName);
      setProfileName('');
    }
  }

  return (
    <div className="w-72 bg-gray-800 p-4 flex flex-col space-y-4">
      <h1 className="text-xl font-bold mb-2">Trial Resetter</h1>
      
      {/* Application Selector */}
      <div>
        <label htmlFor="app-select" className="block text-sm font-medium text-gray-400 mb-1">
          Target Application
        </label>
        <select
          id="app-select"
          value={selectedApp.id}
          onChange={(e) => {
            const app = supportedApps.find(app => app.id === e.target.value);
            if (app) setApp(app);
          }}
          disabled={activeView !== 'resetter'}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {supportedApps.map(app => (
            <option key={app.id} value={app.id}>{app.name}</option>
          ))}
        </select>
      </div>

      {/* Tools Navigation */}
      <nav className="flex flex-col space-y-2">
        <h2 className="text-lg font-semibold text-gray-300 mt-2">Araçlar</h2>
        <button
          onClick={() => setView('resetter')}
          className={`text-left p-2 rounded-md transition-colors ${activeView === 'resetter' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
        >
          Trial Resetter
        </button>
        <button
          onClick={() => setView('cleaner')}
          className={`text-left p-2 rounded-md transition-colors ${activeView === 'cleaner' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
        >
          Uygulama Temizleyici
        </button>
      </nav>

      {/* Conditional Resetter View Options */}
      {activeView === 'resetter' && (
        <>
          {/* Category Navigation */}
          <nav className="flex flex-col space-y-2">
            <h2 className="text-lg font-semibold text-gray-300 mt-2">Options</h2>
            <button
              onClick={() => setCategory('Basic')}
              className={`text-left p-2 rounded-md transition-colors ${activeCategory === 'Basic' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
            >
              Basic
            </button>
            <button
              onClick={() => setCategory('Advanced')}
              className={`text-left p-2 rounded-md transition-colors ${activeCategory === 'Advanced' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
            >
              Advanced
            </button>
          </nav>

          {/* Spacer to push profile section to the bottom */}
          <div className="flex-grow"></div>

          {/* Profile Management */}
          <div className="pt-4 border-t border-gray-700">
            <h2 className="text-lg font-semibold text-gray-300 mb-2">Profiles</h2>
            <div className="flex space-x-2">
              <input 
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="New profile name..."
                className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleSaveProfile} className="p-2 bg-blue-600 rounded-md hover:bg-blue-700" aria-label="Save Profile">
                <Save size={20} />
              </button>
            </div>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {profiles.map(profile => (
                <div key={profile.name} className="flex justify-between items-center bg-gray-700 p-2 rounded-md">
                  <button onClick={() => loadProfile(profile.name)} className="flex-grow text-left hover:text-blue-400">
                    {profile.name}
                  </button>
                  <button onClick={() => deleteProfile(profile.name)} className="text-red-500 hover:text-red-400" aria-label={`Delete ${profile.name} profile`}>
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
} 