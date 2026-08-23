import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Sparkles } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    // Check if user dismissed prompt recently
    const dismissed = localStorage.getItem('d2_pwa_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed, 10) < 86400000 * 3) {
      // Dismissed within 3 days
      return;
    }

    // iOS detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    if (isIosDevice && !window.navigator.standalone) {
      setIsIOS(true);
      setShowPrompt(true);
      return;
    }

    // Chrome / Android / Desktop PWA event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    localStorage.setItem('d2_pwa_dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <>
      {/* Install Floating Banner */}
      <div className="fixed top-16 md:top-20 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-[#161c2b] border border-amber-500/40 rounded-2xl p-3.5 shadow-2xl shadow-black/80 flex items-center justify-between gap-3 animate-slideUp">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white font-heading">
              Install D2 Arsenal App
            </h4>
            <p className="text-[11px] text-slate-400">
              Install for instant offline access & fullscreen mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono transition-colors whitespace-nowrap shadow-sm shadow-amber-500/30"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Instructions Sheet */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-[#121722] border border-[#28354d] rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto">
              <PlusSquare className="w-6 h-6 text-amber-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white font-heading">
                Install on iOS Safari
              </h3>
              <p className="text-xs text-slate-400">
                Follow these 2 quick steps to add the app to your home screen:
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-[#20293a] text-left text-xs space-y-2.5 font-sans text-slate-300">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[11px]">1</span>
                <span>Tap the <strong className="text-white">Share</strong> button <Share className="inline w-3.5 h-3.5 text-amber-400 mx-0.5" /> in Safari's bottom toolbar.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[11px]">2</span>
                <span>Scroll down and select <strong className="text-white">Add to Home Screen</strong> <PlusSquare className="inline w-3.5 h-3.5 text-amber-400 mx-0.5" />.</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
