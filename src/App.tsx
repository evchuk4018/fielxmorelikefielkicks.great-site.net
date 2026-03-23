import React, { useState, useEffect } from 'react';
import { Home } from './tabs/Home';
import { PitScouting } from './tabs/PitScouting';
import { AllianceStrategy } from './tabs/AllianceStrategy';
import { MatchView } from './tabs/MatchView';
import { RawData } from './tabs/RawData';
import { TeamReview } from './tabs/TeamReview';
import { SyncIndicator } from './components/SyncIndicator';
import { SettingsModal } from './components/SettingsModal';
import { ToastProvider } from './components/Toast';
import { syncManager } from './lib/sync';
import { competition } from './lib/competition';
import { Settings, ClipboardList, Activity, Target, Database, House, UserRoundSearch } from 'lucide-react';

type Tab = 'home' | 'pit' | 'match' | 'strategy' | 'raw' | 'review';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasActiveCompetition, setHasActiveCompetition] = useState(Boolean(competition.getActiveProfileId()));

  useEffect(() => {
    syncManager.start();
    const handleActiveCompetitionChanged = () => {
      setHasActiveCompetition(Boolean(competition.getActiveProfileId()));
    };
    window.addEventListener('active-competition-changed', handleActiveCompetitionChanged);
    return () => {
      window.removeEventListener('active-competition-changed', handleActiveCompetitionChanged);
      syncManager.stop();
    };
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <Home onOpenPit={() => setActiveTab('pit')} />;
      case 'pit': return <PitScouting />;
      case 'match': return <MatchView />;
      case 'strategy': return <AllianceStrategy />;
      case 'raw': return <RawData />;
      case 'review': return <TeamReview />;
      default: return <Home onOpenPit={() => setActiveTab('pit')} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500/30">
      {hasActiveCompetition && (
        <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner shadow-white/20">
                <span className="text-white font-bold font-mono text-sm">26</span>
              </div>
              <span className="font-bold text-lg hidden sm:block tracking-tight text-white">REBUILT Scout</span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setActiveTab('home')}
                className={`p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'home' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <House className="w-4 h-4" />
                <span className="hidden md:block">Home</span>
              </button>
              <button
                onClick={() => setActiveTab('pit')}
                className={`p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'pit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span className="hidden md:block">Pit</span>
              </button>
              <button
                onClick={() => setActiveTab('match')}
                className={`p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'match' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span className="hidden md:block">Match</span>
              </button>
              <button
                onClick={() => setActiveTab('strategy')}
                className={`p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'strategy' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Target className="w-4 h-4" />
                <span className="hidden md:block">Stats</span>
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'raw' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Database className="w-4 h-4" />
                <span className="hidden md:block">Raw</span>
              </button>
              <button
                onClick={() => setActiveTab('review')}
                className={`p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'review' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <UserRoundSearch className="w-4 h-4" />
                <span className="hidden md:block">Review</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <SyncIndicator />
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </nav>
      )}

      <main className="p-4 sm:p-6 lg:p-8">
        {renderTab()}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ToastProvider />
    </div>
  );
}
