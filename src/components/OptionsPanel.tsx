import React from 'react';
import { useStore, ResetOption } from '../store';

function OptionItem({ option }: { option: ResetOption }) {
  const { toggleOption, selectedApp } = useStore();
  const label = option.label.replace('{APP_NAME}', selectedApp.name);
  const details = option.details.replace('{APP_NAME}', selectedApp.name);

  return (
    <div 
      className="flex items-start p-3 bg-gray-700/50 rounded-lg transition-all hover:bg-gray-700/80 cursor-pointer"
      onClick={() => toggleOption(option.id)}
    >
      <input
        type="checkbox"
        id={option.id}
        checked={option.checked}
        onChange={() => toggleOption(option.id)}
        className="mt-1 h-4 w-4 rounded border-gray-500 bg-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
      />
      <div className="ml-3 text-sm">
        <label htmlFor={option.id} className="font-medium text-gray-200 cursor-pointer">
          {label}
        </label>
        <p className="text-gray-400">{details}</p>
      </div>
    </div>
  );
}

export function OptionsPanel() {
  const { allOptions, platform, activeCategory } = useStore();

  const visibleOptions = (platform === 'win32' || platform === 'darwin')
    ? allOptions.filter(option => 
        option.platforms.includes(platform) && option.category === activeCategory
      )
    : [];

  if (!platform) {
    return <div className="p-4 text-center">Detecting platform...</div>;
  }
  
  return (
    <div className="p-4 space-y-3">
       <h2 className="text-xl font-bold text-gray-200 mb-2">{activeCategory} Options</h2>
      {visibleOptions.length > 0 ? (
        visibleOptions.map(option => <OptionItem key={option.id} option={option} />)
      ) : (
        <p className="text-gray-400">No {activeCategory.toLowerCase()} options available for your platform.</p>
      )}
    </div>
  );
} 