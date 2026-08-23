import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import WeaponFinder from './components/WeaponFinder';
import WeaponModal from './components/WeaponModal';
import ArmorFinder from './components/ArmorFinder';
import ArmorModal from './components/ArmorModal';
import GuardianManager from './components/GuardianManager';
import PerkEncyclopedia from './components/PerkEncyclopedia';
import WeaponCompare from './components/WeaponCompare';
import WishlistManager from './components/WishlistManager';
import SettingsModal from './components/SettingsModal';
import OAuthCallback from './components/OAuthCallback';
import InfoDrawer from './components/InfoDrawer';
import MobileBottomNav from './components/MobileBottomNav';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { getSavedWishlists, saveWishlistRoll, removeWishlistRoll } from './utils/destiny-helpers';
import { initClientManifest, getFiltersMetadata } from './utils/client-manifest';
import { 
  getStoredSettings, 
  getStoredAuthSession, 
  saveStoredAuthSession, 
  clearStoredAuthSession 
} from './utils/auth-storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('weapons');
  const [manifestStatus, setManifestStatus] = useState(null);
  const [filtersMetadata, setFiltersMetadata] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Auth Session State (Instantly restored from browser localStorage!)
  const [authSession, setAuthSession] = useState(() => getStoredAuthSession());
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);

  // Modals & Info Drawer
  const [selectedWeapon, setSelectedWeapon] = useState(null);
  const [selectedArmor, setSelectedArmor] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [infoDrawerItem, setInfoDrawerItem] = useState(null);

  // Compare & Wishlist
  const [compareList, setCompareList] = useState([]);
  const [wishlists, setWishlists] = useState([]);

  // Toast notifications
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Check if we are on the OAuth callback URL
  useEffect(() => {
    if (window.location.pathname.includes('/oauth/callback') || window.location.search.includes('code=')) {
      setIsOAuthCallback(true);
    }
  }, []);

  // Load initial status, metadata & auth session
  useEffect(() => {
    setFiltersMetadata(getFiltersMetadata());
    checkAuthSession();
    setWishlists(getSavedWishlists());

    initClientManifest().then(counts => {
      if (counts && counts.weaponsCount > 0) {
        setManifestStatus({
          status: 'ready',
          weaponsCount: counts.weaponsCount,
          armorCount: counts.armorCount,
          perksCount: counts.perksCount
        });
        setFiltersMetadata(getFiltersMetadata());
      }
    });

    fetchStatus();
    fetchFilters();

    try {
      const savedCompare = sessionStorage.getItem('destiny2_compare_list');
      if (savedCompare) setCompareList(JSON.parse(savedCompare));
    } catch (e) {}
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        if (data && data.weaponsCount) {
          setManifestStatus(data);
        }
      }
    } catch (e) {}
  };

  const fetchFilters = async () => {
    try {
      const res = await fetch('/api/filters');
      if (res.ok) {
        const data = await res.json();
        if (data && data.weaponTypes) {
          setFiltersMetadata(data);
        }
      }
    } catch (e) {}
  };

  const checkAuthSession = async () => {
    const local = getStoredAuthSession();
    if (local && local.authenticated) {
      setAuthSession(local);
    }
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        if (data && data.authenticated) {
          saveStoredAuthSession(data);
          setAuthSession(data);
        }
      }
    } catch (e) {}
  };

  const handleLogin = () => {
    const settings = getStoredSettings();
    if (!settings.clientId) {
      setIsSettingsOpen(true);
      showToast('Please configure your Bungie OAuth Client ID in Settings first.', 'warning');
      return;
    }

    const redirectUri = `${window.location.origin}/oauth/callback`;
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://www.bungie.net/en/OAuth/Authorize?client_id=${encodeURIComponent(settings.clientId)}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
  };

  const handleLogout = async () => {
    clearStoredAuthSession();
    setAuthSession({ authenticated: false, session: null });
    showToast('Logged out from Bungie.net', 'info');
  };

  const handleOAuthComplete = (session) => {
    setIsOAuthCallback(false);
    const updated = saveStoredAuthSession(session);
    setAuthSession(updated);
    setActiveTab('guardian');
    showToast('Successfully logged in with Bungie.net!', 'success');
  };

  const handleTriggerSync = async (force = false) => {
    setIsSyncing(true);
    try {
      await fetch('/api/manifest/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force })
      });
      fetchStatus();
    } catch (e) {
      console.error('Sync failed:', e);
      setIsSyncing(false);
    }
  };

  const handleAddToCompare = (weapon) => {
    setCompareList(prev => {
      let next;
      if (prev.some(w => w.id === weapon.id)) {
        next = prev.filter(w => w.id !== weapon.id);
        showToast(`Removed ${weapon.name} from comparison`, 'info');
      } else {
        if (prev.length >= 4) {
          showToast('Comparison lab is limited to 4 weapons max', 'warning');
          return prev;
        }
        next = [...prev, weapon];
        showToast(`Added ${weapon.name} to comparison lab`, 'success');
      }
      try { sessionStorage.setItem('destiny2_compare_list', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const handleRemoveFromCompare = (weaponId) => {
    setCompareList(prev => {
      const next = prev.filter(w => w.id !== weaponId);
      try { sessionStorage.setItem('destiny2_compare_list', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const handleClearCompare = () => {
    setCompareList([]);
    try { sessionStorage.removeItem('destiny2_compare_list'); } catch (e) {}
    showToast('Cleared comparison lab', 'info');
  };

  const handleSaveWishlist = (roll) => {
    const updated = saveWishlistRoll(roll);
    setWishlists(updated);
    showToast(`Saved ${roll.name} roll to Wishlist!`, 'success');
  };

  const handleRemoveWishlist = (rollId) => {
    const updated = removeWishlistRoll(rollId);
    setWishlists(updated);
    showToast('Removed roll from Wishlist', 'info');
  };

  if (isOAuthCallback) {
    return <OAuthCallback onComplete={handleOAuthComplete} />;
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      
      {/* PWA Install Banner */}
      <PWAInstallPrompt />

      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        manifestStatus={manifestStatus}
        onOpenSettings={() => setIsSettingsOpen(true)}
        compareCount={compareList.length}
        wishlistCount={wishlists.length}
        authSession={authSession}
        onLogin={handleLogin}
      />

      {/* Main Content Area (Extra bottom padding on mobile for Bottom Nav) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-8 py-5 pb-24 md:pb-8">
        
        {activeTab === 'weapons' && (
          <WeaponFinder
            onSelectWeapon={(w) => setSelectedWeapon(w)}
            onAddToCompare={handleAddToCompare}
            compareList={compareList}
            onSaveWishlist={handleSaveWishlist}
            filtersMetadata={filtersMetadata}
            onOpenInfo={(item) => setInfoDrawerItem(item)}
          />
        )}

        {activeTab === 'armor' && (
          <ArmorFinder
            onSelectArmor={(a) => setSelectedArmor(a)}
            onOpenInfo={(item) => setInfoDrawerItem(item)}
          />
        )}

        {activeTab === 'guardian' && (
          <GuardianManager
            onSelectWeapon={(w) => setSelectedWeapon(w)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            authSession={authSession}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onOpenInfo={(item) => setInfoDrawerItem(item)}
          />
        )}

        {activeTab === 'perks' && (
          <PerkEncyclopedia
            onSelectWeapon={(w) => setSelectedWeapon(w)}
            onOpenInfo={(item) => setInfoDrawerItem(item)}
          />
        )}

        {activeTab === 'compare' && (
          <WeaponCompare
            compareList={compareList}
            onRemoveFromCompare={handleRemoveFromCompare}
            onClearCompare={handleClearCompare}
            onSelectWeapon={(w) => setSelectedWeapon(w)}
            onOpenInfo={(item) => setInfoDrawerItem(item)}
          />
        )}

        {activeTab === 'wishlist' && (
          <WishlistManager
            wishlists={wishlists}
            onRemoveRoll={handleRemoveWishlist}
            onSelectWeapon={(w) => setSelectedWeapon(w)}
            onOpenInfo={(item) => setInfoDrawerItem(item)}
          />
        )}

      </main>

      {/* Mobile Bottom Navigation Bar (md:hidden) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        compareCount={compareList.length}
        wishlistCount={wishlists.length}
        authSession={authSession}
      />

      {/* Modals & Inspection Sheets */}
      {selectedWeapon && (
        <WeaponModal
          weapon={selectedWeapon}
          onClose={() => setSelectedWeapon(null)}
          onAddToCompare={handleAddToCompare}
          isCompared={compareList.some(w => w.id === selectedWeapon.id)}
          onSaveWishlist={handleSaveWishlist}
          onOpenInfo={(item) => setInfoDrawerItem(item)}
        />
      )}

      {selectedArmor && (
        <ArmorModal
          armor={selectedArmor}
          onClose={() => setSelectedArmor(null)}
          onOpenInfo={(item) => setInfoDrawerItem(item)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          manifestStatus={manifestStatus}
          onTriggerSync={handleTriggerSync}
          isSyncing={isSyncing}
        />
      )}

      {/* Universal Long-Press Info Drawer (Mobile Bottom Sheet / Desktop Modal) */}
      {infoDrawerItem && (
        <InfoDrawer
          item={infoDrawerItem}
          onClose={() => setInfoDrawerItem(null)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 text-sm font-medium shadow-2xl shadow-black/80 flex items-center gap-2 animate-bounce">
          <span>{toast.message}</span>
        </div>
      )}

      {/* Footer (Hidden on small screens since bottom nav is present) */}
      <footer className="hidden md:block border-t border-[#20293a] py-6 px-4 text-center text-xs text-slate-500 space-y-1">
        <p>Destiny 2 Arsenal & Perk Explorer • Powered by Bungie.net Manifest API & OAuth 2.0</p>
        <p>Destiny is a registered trademark of Bungie Inc. Data queried directly from the live Destiny 2 Manifest.</p>
      </footer>

    </div>
  );
}
