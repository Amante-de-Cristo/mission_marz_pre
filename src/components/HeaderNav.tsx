import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Music,
  SkipBack,
  SkipForward,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Sliders,
  Users,
  MapPin,
  ChevronDown,
  Pause,
} from 'lucide-react';
import { ResourceTelemetry, LandingSite, RecommendedPodTarget } from '../types';
import { DEFAULT_LANDING_SITE } from '../utils/landingSites';
import { audioManager } from '../utils/audioManager';

interface HeaderNavProps {
  telemetry: ResourceTelemetry;
  canLaunch: boolean;
  missingEssentialCount: number;
  missingPodNames: string[];
  unmetRecommendations?: RecommendedPodTarget[];
  totalRecommendedCount?: number;
  metRecommendedCount?: number;
  isSimulating: boolean;
  landingSite?: LandingSite;
  crewSize: number;
  onStartSimulation: () => void;
  onOpenTutorial: () => void;
  onOpenConfig: () => void;
  onOpenHome: () => void;
  onOpenSiteSelector: () => void;
  onLoadPreset: () => void;
  onClearBase: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  telemetry,
  canLaunch,
  missingEssentialCount,
  missingPodNames,
  unmetRecommendations = [],
  totalRecommendedCount = 0,
  metRecommendedCount = 0,
  isSimulating,
  landingSite = DEFAULT_LANDING_SITE,
  crewSize,
  onStartSimulation,
  onOpenTutorial,
  onOpenConfig,
  onOpenHome,
  onOpenSiteSelector,
  onLoadPreset,
  onClearBase,
}) => {
  const initialStatus = audioManager.getMusicStatus();
  const [sfxMuted, setSfxMuted] = useState(initialStatus.isSfxMuted);
  const [musicMuted, setMusicMuted] = useState(initialStatus.isMusicMuted);
  const [musicVol, setMusicVol] = useState(initialStatus.volume);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showMissingTooltip, setShowMissingTooltip] = useState(false);
  const [currentTrackTitle, setCurrentTrackTitle] = useState(initialStatus.currentTrack);

  const audioMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const status = audioManager.getMusicStatus();
    setMusicMuted(status.isMusicMuted);
    setSfxMuted(status.isSfxMuted);
    setCurrentTrackTitle(status.currentTrack);
    setMusicVol(status.volume);
  }, []);

  // Close Mac-style audio menu on outside click
  useEffect(() => {
    if (!showAudioMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setShowAudioMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showAudioMenu]);

  useEffect(() => {
    if (isSimulating) {
      setShowAudioMenu(false);
    }
  }, [isSimulating]);

  const handleToggleSfx = () => {
    const isUnmuted = audioManager.toggleSfx();
    setSfxMuted(!isUnmuted);
    if (isUnmuted) audioManager.playClick();
  };

  const handleToggleMusic = () => {
    const isPlaying = audioManager.toggleMusic();
    setMusicMuted(!isPlaying);
    const status = audioManager.getMusicStatus();
    setCurrentTrackTitle(status.currentTrack);
    audioManager.playClick();
  };

  const handlePrevTrack = () => {
    audioManager.prevTrack();
    const status = audioManager.getMusicStatus();
    setCurrentTrackTitle(status.currentTrack);
    setMusicMuted(false);
    audioManager.playClick();
  };

  const handleNextTrack = () => {
    audioManager.nextTrack();
    const status = audioManager.getMusicStatus();
    setCurrentTrackTitle(status.currentTrack);
    setMusicMuted(false);
    audioManager.playClick();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setMusicVol(v);
    audioManager.setMusicVolume(v);
  };

  const formatCurrency = (val: number) => {
    if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <header className="h-14 shrink-0 z-30 flex items-center justify-between gap-3 px-4 bg-[#10101A] border-b border-[#2A2442] select-none whitespace-nowrap">
      {/* Brand: Circular Logo & Title Only */}
      <button
        type="button"
        onClick={() => {
          audioManager.playClick();
          onOpenHome();
        }}
        data-testid="header-home-logo-btn"
        className="flex items-center gap-2.5 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
        title="Return to Home Screen"
      >
        <img
          src="/assets/aistudio/logo_new_f57edc92.png"
          alt="Cosmic Cupcake mission-marz"
          className="w-9 h-9 rounded-full object-cover border border-[#8B5CF6] shrink-0"
        />
        <h1 className="text-sm sm:text-base font-bold tracking-wide text-[#E9D5FF] whitespace-nowrap">
          mission-marz
        </h1>
      </button>

      {/* Center Readout + Active Landing Site */}
      <div className="hidden xl:flex items-center gap-4 px-3.5 py-1.5 rounded-xl bg-[#09090F] border border-[#2A2442] shrink-0">
        <button
          onClick={() => {
            audioManager.playClick();
            onOpenSiteSelector();
          }}
          data-testid="header-site-btn"
          className="flex items-center gap-1.5 text-left hover:text-white transition-colors cursor-pointer"
          title="Change Mars Landing Site"
        >
          <MapPin className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
          <div>
            <div className="text-[10px] text-[#9F8FC7]">Landing Site</div>
            <div className="text-xs font-bold text-[#E9D5FF]">{landingSite.name}</div>
          </div>
        </button>

        <div className="w-px h-6 bg-[#2A2442]" />

        <div>
          <div className="text-[10px] text-[#9F8FC7]">
            {telemetry.isInfiniteBudget ? 'Total Spent' : 'Budget Left'}
          </div>
          <div
            className={`text-xs font-bold ${
              telemetry.isInfiniteBudget || telemetry.budgetRemainingUSD >= 0
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {telemetry.isInfiniteBudget
              ? `${formatCurrency(telemetry.totalBaseSpendUSD)} (Unlimited)`
              : formatCurrency(telemetry.budgetRemainingUSD)}
          </div>
        </div>

        <div className="w-px h-6 bg-[#2A2442]" />

        <div>
          <div className="text-[10px] text-[#9F8FC7]">Power</div>
          <div
            className={`text-xs font-bold ${
              telemetry.netPowerKW >= 0 ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            {telemetry.netPowerKW >= 0 ? `+${telemetry.netPowerKW}` : telemetry.netPowerKW} kW
          </div>
        </div>

        <div className="w-px h-6 bg-[#2A2442]" />

        <div>
          <div className="text-[10px] text-[#9F8FC7]">Crew / Beds</div>
          <div className="text-xs font-bold text-[#E9D5FF] flex items-center gap-1">
            <Users className="w-3 h-3 text-[#A78BFA]" />
            <span>
              {crewSize} / {telemetry.crewCapacity}
            </span>
          </div>
        </div>
      </div>

      {/* Right Toolbar & Mac-Style Music Dropdown */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Consolidated Mac-Style Music & Audio Dropdown */}
        <div className="relative" ref={audioMenuRef}>
          <button
            onClick={() => {
              setShowAudioMenu((prev) => !prev);
              audioManager.playClick();
            }}
            data-testid="audio-dropdown-btn"
            className="px-2.5 py-1.5 rounded-lg bg-[#151324] hover:bg-[#1E1A33] text-[#E9D5FF] border border-[#2A2442] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Audio & Music Controls"
          >
            <Music
              className={`w-3.5 h-3.5 ${musicMuted ? 'text-[#6D5B97]' : 'text-[#A78BFA]'}`}
            />
            <span className="hidden sm:inline max-w-28 truncate">{currentTrackTitle}</span>
            <ChevronDown className="w-3 h-3 text-[#9F8FC7]" />
          </button>

          {showAudioMenu && (
            <div
              data-testid="audio-dropdown-menu"
              className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-[#151324] border border-[#35285C] shadow-xl z-50 p-3 space-y-3 text-left whitespace-normal"
            >
              {/* Track Header */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#2A2442]">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9F8FC7]">
                    Now Playing
                  </div>
                  <div className="text-xs font-bold text-[#E9D5FF] truncate">
                    {currentTrackTitle}
                  </div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#09090F] text-[#A78BFA] border border-[#2A2442]">
                  {musicMuted ? 'Paused' : 'Playing'}
                </span>
              </div>

              {/* Playback Transport Row */}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handlePrevTrack}
                  data-testid="audio-prev-btn"
                  className="p-2 rounded-lg bg-[#09090F] hover:bg-[#221C3A] text-[#E9D5FF] border border-[#2A2442] transition-colors cursor-pointer"
                  title="Previous Track"
                  aria-label="Previous Track"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleToggleMusic}
                  data-testid="audio-toggle-music-btn"
                  className="px-3.5 py-2 rounded-lg bg-[#5B2C98] hover:bg-[#8B5CF6] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title={musicMuted ? 'Play Music' : 'Mute Music'}
                >
                  {musicMuted ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Mute Music</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleNextTrack}
                  data-testid="audio-next-btn"
                  className="p-2 rounded-lg bg-[#09090F] hover:bg-[#221C3A] text-[#E9D5FF] border border-[#2A2442] transition-colors cursor-pointer"
                  title="Next Track"
                  aria-label="Next Track"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Volume Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#C4B5FD]">
                  <span>Music Volume</span>
                  <span>{Math.round(musicVol * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVol}
                  onChange={handleVolumeChange}
                  data-testid="audio-volume-slider"
                  className="w-full accent-[#8B5CF6] cursor-pointer"
                />
              </div>

              {/* Sound Effects Toggle */}
              <button
                onClick={handleToggleSfx}
                data-testid="audio-toggle-sfx-btn"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#09090F] hover:bg-[#221C3A] border border-[#2A2442] flex items-center justify-between text-xs text-[#E9D5FF] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {sfxMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-[#6D5B97]" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-[#A78BFA]" />
                  )}
                  <span>Button Sound Effects</span>
                </span>
                <span className={sfxMuted ? 'text-[#9F8FC7]' : 'text-emerald-400 font-semibold'}>
                  {sfxMuted ? 'Off' : 'On'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => {
            audioManager.playClick();
            onOpenConfig();
          }}
          className="px-2.5 py-1.5 rounded-lg bg-[#151324] hover:bg-[#1E1A33] text-[#E9D5FF] border border-[#2A2442] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Mission Settings"
        >
          <Sliders className="w-3.5 h-3.5 text-[#A78BFA]" />
          <span className="hidden sm:inline">Settings</span>
        </button>

        {/* Load Preset */}
        <button
          onClick={() => {
            audioManager.playClick();
            onLoadPreset();
          }}
          className="px-2.5 py-1.5 rounded-lg bg-[#151324] hover:bg-[#1E1A33] text-[#E9D5FF] border border-[#35285C] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Load Starter Mars Base"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
          <span className="hidden md:inline">Starter Base</span>
        </button>

        {/* Reset Grid */}
        <button
          onClick={() => {
            audioManager.playClick();
            onClearBase();
          }}
          className="p-1.5 rounded-lg bg-[#151324] hover:bg-rose-950 text-[#C4B5FD] hover:text-rose-300 border border-[#2A2442] transition-colors cursor-pointer"
          title="Clear All Buildings"
          aria-label="Clear All Buildings"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Help / Guide */}
        <button
          onClick={() => {
            audioManager.playClick();
            onOpenTutorial();
          }}
          className="p-1.5 rounded-lg bg-[#151324] hover:bg-[#1E1A33] text-[#C4B5FD] hover:text-white border border-[#2A2442] transition-colors cursor-pointer"
          title="How to Play"
          aria-label="How to Play"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Start 30-Day Simulation Button */}
        <div className="relative">
          <button
            onClick={() => {
              if (canLaunch && !isSimulating) {
                audioManager.playClick();
                onStartSimulation();
              } else if (!canLaunch) {
                audioManager.playError();
                setShowMissingTooltip((prev) => !prev);
              }
            }}
            onMouseEnter={() => !canLaunch && setShowMissingTooltip(true)}
            onMouseLeave={() => setShowMissingTooltip(false)}
            disabled={isSimulating}
            data-testid="start-simulation-btn"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              canLaunch
                ? 'bg-[#5B2C98] hover:bg-[#8B5CF6] text-white cursor-pointer'
                : 'bg-[#151324] text-[#9F8FC7] border border-[#2A2442] cursor-not-allowed'
            }`}
          >
            {isSimulating ? (
              <span>Simulating...</span>
            ) : canLaunch ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start 30-Day Simulation</span>
              </>
            ) : missingEssentialCount > 0 ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Required: {10 - missingEssentialCount}/10</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Tips Goals: {metRecommendedCount}/{totalRecommendedCount}
                </span>
              </>
            )}
          </button>

          {showMissingTooltip && !canLaunch && (
            <div
              data-testid="launch-blocked-tooltip"
              className="absolute right-0 top-full mt-2 w-80 p-3 rounded-xl bg-[#151324] border border-rose-500/50 shadow-xl z-50 text-left whitespace-normal space-y-2"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {missingEssentialCount > 0
                    ? 'Missing Essential Buildings'
                    : 'Finish Tips Requirements First'}
                </span>
              </div>
              <p className="text-[11px] text-[#C4B5FD] leading-relaxed">
                Place all 10 required buildings and turn every item in the Tips tab green before
                launching.
              </p>

              {missingEssentialCount > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[#9F8FC7] mb-1 uppercase">
                    Essential Buildings Needed ({missingEssentialCount}):
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {missingPodNames.map((name) => (
                      <div key={name} className="text-[11px] text-amber-300">
                        • {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unmetRecommendations.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[#9F8FC7] mb-1 uppercase">
                    Incomplete Tips Targets ({unmetRecommendations.length}):
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {unmetRecommendations.map((rec) => (
                      <div
                        key={rec.podId}
                        className="text-[11px] text-amber-300 flex items-center justify-between gap-2"
                      >
                        <span className="truncate">• {rec.podName}</span>
                        <span className="shrink-0 font-bold">
                          {rec.placedCount}/{rec.recommendedCount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
