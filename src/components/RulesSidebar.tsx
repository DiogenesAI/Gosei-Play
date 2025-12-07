import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppTheme } from '../context/AppThemeContext';

interface RulesSidebarProps {
  className?: string;
}

const RulesSidebar: React.FC<RulesSidebarProps> = ({ className = '' }) => {
  const { isDarkMode } = useAppTheme();
  const [activeTab, setActiveTab] = useState<'basic' | 'scoring' | 'tips'>('basic');

  return (
    <div className={`rounded-xl shadow-lg p-6 transition-colors duration-200 ${isDarkMode ? 'bg-slate-800' : 'bg-white'} ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-xl font-bold font-display tracking-tight ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>Go Rules Quick Guide</h2>
        <Link
          to="/rules"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          Full Rules →
        </Link>
      </div>

      {/* Tab Navigation */}
      <div className={`flex border-b mb-4 ${isDarkMode ? 'border-slate-700' : 'border-neutral-200'}`}>
        <button
          onClick={() => setActiveTab('basic')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'basic'
            ? 'border-primary-500 text-primary-500'
            : `border-transparent ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-neutral-600 hover:text-neutral-800'}`
            }`}
        >
          Basic Rules
        </button>
        <button
          onClick={() => setActiveTab('scoring')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'scoring'
            ? 'border-primary-500 text-primary-500'
            : `border-transparent ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-neutral-600 hover:text-neutral-800'}`
            }`}
        >
          Scoring
        </button>
        <button
          onClick={() => setActiveTab('tips')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tips'
            ? 'border-primary-500 text-primary-500'
            : `border-transparent ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-neutral-600 hover:text-neutral-800'}`
            }`}
        >
          Tips
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'basic' && (
          <div className="space-y-3">
            <div className={`p-3 rounded-lg transition-colors duration-200 ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
              <h4 className={`font-semibold text-sm mb-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>🎯 Objective</h4>
              <p className={`text-xs ${isDarkMode ? 'text-blue-100/90' : 'text-blue-700'}`}>
                Control more territory than your opponent by placing stones and capturing enemy groups.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold text-sm">1.</span>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>Place stones on intersections</p>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>Black plays first, then alternate</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-orange-600 font-bold text-sm">2.</span>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>Capture by removing liberties</p>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>Surround enemy stones completely</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-purple-600 font-bold text-sm">3.</span>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>No suicide moves</p>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>Can't place without liberties unless capturing</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="text-red-600 font-bold text-sm">4.</span>
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>Ko rule prevents loops</p>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>Can't immediately recapture</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scoring' && (
          <div className="space-y-3">
            <div className={`p-3 rounded-lg transition-colors duration-200 ${isDarkMode ? 'bg-green-900/20' : 'bg-green-50'}`}>
              <h4 className={`font-semibold text-sm mb-1 ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>🏆 How to Win</h4>
              <p className={`text-xs ${isDarkMode ? 'text-green-100/90' : 'text-green-700'}`}>
                Player with the most points wins!
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>Territory Points</span>
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>+1 per empty intersection</span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>Captured Stones</span>
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>+1 per captured stone</span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>Komi (White bonus)</span>
                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>Usually +6.5 points</span>
              </div>
            </div>

            <div className={`p-3 rounded-lg transition-colors duration-200 ${isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'}`}>
              <h4 className={`font-semibold text-sm mb-1 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-800'}`}>💡 Territory</h4>
              <p className={`text-xs ${isDarkMode ? 'text-yellow-100/90' : 'text-yellow-700'}`}>
                Empty intersections completely surrounded by your stones count as your territory.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'tips' && (
          <div className="space-y-3">
            <div className={`p-3 rounded-lg transition-colors duration-200 ${isDarkMode ? 'bg-amber-900/20' : 'bg-amber-50'}`}>
              <h4 className={`font-semibold text-sm mb-1 ${isDarkMode ? 'text-amber-300' : 'text-amber-800'}`}>🎲 For Beginners</h4>
              <p className={`text-xs ${isDarkMode ? 'text-amber-100/90' : 'text-amber-700'}`}>
                Start with 9×9 boards for quick games and learning!
              </p>
            </div>

            <div className="space-y-2">
              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>📍 Opening Strategy</p>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>Play corners first, then sides, then center</p>
              </div>

              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>🔗 Connect Your Stones</p>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>Connected groups share liberties and are stronger</p>
              </div>

              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>👀 Count Liberties</p>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>Always check if your groups can be captured</p>
              </div>

              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-neutral-900'}`}>🎯 Think Territory</p>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-neutral-600'}`}>Build walls around areas you want to control</p>
              </div>
            </div>

            <div className={`p-3 rounded-lg transition-colors duration-200 ${isDarkMode ? 'bg-teal-900/20' : 'bg-teal-50'}`}>
              <h4 className={`font-semibold text-sm mb-1 ${isDarkMode ? 'text-teal-300' : 'text-teal-800'}`}>⭐ Pro Tip</h4>
              <p className={`text-xs ${isDarkMode ? 'text-teal-100/90' : 'text-teal-700'}`}>
                Look for star points (hoshi) - they're good opening moves!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className={`mt-6 pt-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-neutral-200'}`}>
        <Link
          to="/rules"
          className="block text-center px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
        >
          <div className="flex items-center justify-center gap-2 text-white">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-white">Read Complete Rules</span>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default RulesSidebar; 