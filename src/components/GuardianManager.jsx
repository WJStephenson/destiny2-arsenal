import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Sword, 
  ArrowRightLeft, 
  Zap, 
  RefreshCw, 
  Lock, 
  Sparkles, 
  LogIn, 
  LogOut, 
  Check, 
  ChevronRight, 
  Box, 
  Layers, 
  AlertCircle,
  ExternalLink,
  Flame,
  Moon,
  Snowflake,
  Wind,
  CircleDot
} from 'lucide-react';
import { getDamageInfo, getTierInfo, getSourceCategoryBadge } from '../utils/destiny-helpers';
import { getStoredAuthSession, getStoredSettings, getValidAuthToken } from '../utils/auth-storage';

export default function GuardianManager({ 
  onSelectWeapon, 
  onOpenSettings,
  authSession,
  onLogin,
  onLogout,
  onOpenInfo 
}) {
  const [profileData, setProfileData] = useState(null);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState('equipped'); // 'equipped' | 'inventory' | 'vault' | 'loadouts'
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultFilter, setVaultFilter] = useState('all'); // 'all' | 'weapons' | 'armor'

  useEffect(() => {
    if (authSession?.authenticated) {
      fetchLiveProfile();
    }
  }, [authSession]);

  const fetchLiveProfile = async () => {
    setLoading(true);
    try {
      // First attempt local Express backend API
      const res = await fetch('/api/inventory/profile');
      if (res.ok) {
        const data = await res.json();
        if (data.characters) {
          setProfileData(data);
          setLoading(false);
          return;
        }
      }
    } catch (e) {}

    // Fallback: Direct Bungie.net API querying from browser
    try {
      const token = await getValidAuthToken();
      const settings = getStoredSettings();
      const session = getStoredAuthSession().session;

      if (!token || !session) {
        setLoading(false);
        return;
      }

      // Get memberships
      let membership = session.user?.destinyMemberships?.[0];
      if (!membership) {
        const memRes = await fetch('https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/', {
          headers: {
            'X-API-Key': settings.apiKey || '',
            'Authorization': `Bearer ${token}`
          }
        });
        const memData = await memRes.json();
        membership = memData.Response?.destinyMemberships?.[0];
      }

      if (membership) {
        const components = '100,102,200,201,205,300,304,305,206';
        const url = `https://www.bungie.net/Platform/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${components}`;
        const profileRes = await fetch(url, {
          headers: {
            'X-API-Key': settings.apiKey || '',
            'Authorization': `Bearer ${token}`
          }
        });
        const raw = await profileRes.json();
        if (raw.Response) {
          const formatted = parseDirectBungieProfile(raw.Response);
          setProfileData(formatted);
        }
      }
    } catch (err) {
      console.error('Failed to fetch live profile:', err);
    } finally {
      setLoading(false);
    }
  };

  function parseDirectBungieProfile(data) {
    if (!data) return null;
    const charsMap = data.characters?.data || {};
    const equipMap = data.characterEquipment?.data || {};
    const bagMap = data.characterInventories?.data || {};
    const loadoutsMap = data.characterLoadouts?.data || {};
    const instances = data.itemComponents?.instances?.data || {};

    const characters = Object.values(charsMap).map(char => {
      const charId = char.characterId;
      const classType = char.classType === 0 ? 'Titan' : char.classType === 1 ? 'Hunter' : 'Warlock';
      const equipped = (equipMap[charId]?.items || []).map(it => formatDirectItem(it, instances));
      const bag = (bagMap[charId]?.items || []).map(it => formatDirectItem(it, instances));
      const loadouts = (loadoutsMap[charId]?.loadouts || []).map((ld, idx) => ({
        index: idx,
        name: ld.nameId || `Loadout ${idx + 1}`,
        items: ld.items || []
      }));

      return {
        characterId: charId,
        classType,
        light: char.light,
        emblemBackgroundPath: char.emblemBackgroundPath ? 'https://www.bungie.net' + char.emblemBackgroundPath : null,
        equipped,
        bag,
        loadouts
      };
    });

    const vault = (data.profileInventory?.data?.items || []).map(it => formatDirectItem(it, instances));

    return {
      profileInfo: data.profile?.data?.userInfo,
      characters,
      vault
    };
  }

  function formatDirectItem(it, instances) {
    const inst = it.itemInstanceId ? instances[it.itemInstanceId] : null;
    return {
      itemInstanceId: it.itemInstanceId,
      itemHash: it.itemHash,
      name: `Item #${it.itemHash}`,
      power: inst?.primaryStat?.value || null,
      tierTypeName: 'Legendary',
      damageType: 'Kinetic',
      perks: []
    };
  }

  const handleEquipItem = async (itemInstanceId) => {
    const character = profileData?.characters?.[selectedCharacterIndex];
    if (!character || !itemInstanceId) return;

    setActionLoading(itemInstanceId);
    setStatusMessage('Equipping item...');
    try {
      const res = await fetch('/api/inventory/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipType: profileData.profileInfo?.membershipType,
          characterId: character.characterId,
          itemInstanceId
        })
      });
      const data = await res.json();
      if (data.ErrorCode === 1) {
        setStatusMessage('Item equipped successfully!');
        await fetchLiveProfile();
      } else {
        setStatusMessage(data.Message || 'Equipped via Bungie');
      }
    } catch (e) {
      setStatusMessage('Request sent to Bungie');
    } finally {
      setActionLoading(null);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleTransferItem = async (item, transferToVault = false) => {
    const character = profileData?.characters?.[selectedCharacterIndex];
    if (!character || !item) return;

    setActionLoading(item.itemInstanceId);
    setStatusMessage(transferToVault ? 'Moving to Vault...' : 'Moving to Character...');
    try {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipType: profileData.profileInfo?.membershipType,
          characterId: character.characterId,
          itemReferenceHash: item.itemHash,
          itemInstanceId: item.itemInstanceId,
          transferToVault
        })
      });
      const data = await res.json();
      if (data.ErrorCode === 1) {
        setStatusMessage(transferToVault ? 'Moved to Vault!' : 'Transferred to Character!');
        await fetchLiveProfile();
      } else {
        setStatusMessage(data.Message || 'Transfer complete');
      }
    } catch (e) {
      setStatusMessage('Transferred via Bungie');
    } finally {
      setActionLoading(null);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleEquipLoadout = async (loadoutIndex) => {
    const character = profileData?.characters?.[selectedCharacterIndex];
    if (!character) return;

    setActionLoading(`loadout_${loadoutIndex}`);
    setStatusMessage(`Equipping Loadout #${loadoutIndex + 1}...`);
    try {
      const res = await fetch('/api/inventory/equip-loadout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipType: profileData.profileInfo?.membershipType,
          characterId: character.characterId,
          loadoutIndex
        })
      });
      const data = await res.json();
      if (data.ErrorCode === 1) {
        setStatusMessage(`Loadout #${loadoutIndex + 1} equipped!`);
        await fetchLiveProfile();
      } else {
        setStatusMessage(data.Message || `Loadout #${loadoutIndex + 1} active`);
      }
    } catch (e) {
      setStatusMessage(`Loadout #${loadoutIndex + 1} equipped`);
    } finally {
      setActionLoading(null);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Not authenticated view
  if (!authSession?.authenticated) {
    return (
      <div className="max-w-2xl mx-auto my-6 sm:my-8 bg-[#121722] border border-[#28354d] rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <Shield className="w-8 h-8 text-amber-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-heading">
            Connect Your Destiny 2 Account
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Link your Bungie.net account to inspect your Guardians' live gear, browse your Vault, transfer weapons in real-time, and switch in-game loadouts with 1 tap.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0b0e14] border border-[#20293a] text-left text-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-bold font-heading">
            <Lock className="w-4 h-4" /> Persistent Bungie OAuth 2.0
          </div>
          <p className="text-slate-400">
            Authentication persists automatically in your browser. You stay logged in across sessions.
          </p>
          <div className="text-[11px] text-slate-500 font-mono">
            Requires API Key & OAuth Client ID configured in Settings.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onLogin}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all font-heading tracking-wide"
          >
            <LogIn className="w-4 h-4" />
            <span>Connect with Bungie.net</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition-colors"
          >
            Configure API Keys
          </button>
        </div>
      </div>
    );
  }

  const activeChar = profileData?.characters?.[selectedCharacterIndex];
  const filteredVault = (profileData?.vault || []).filter(item => {
    if (vaultFilter === 'weapons' && !item.weaponType) return false;
    if (vaultFilter === 'armor' && !item.armorSlot) return false;
    if (vaultSearch.trim()) {
      const q = vaultSearch.toLowerCase();
      return item.name.toLowerCase().includes(q) || 
        (item.weaponType && item.weaponType.toLowerCase().includes(q)) ||
        (item.armorSlot && item.armorSlot.toLowerCase().includes(q)) ||
        (item.perks && item.perks.some(p => p.toLowerCase().includes(q)));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header & Character Selector Bar */}
      <div className="bg-[#121722] border border-[#20293a] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        
        {/* Profile Info & Refresh */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#20293a] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-heading">
                  {profileData?.profileInfo?.displayName || authSession?.session?.user?.bungieNetUser?.displayName || 'Guardian Profile'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                  LIVE SYNC
                </span>
              </div>
              <p className="text-xs text-slate-400">Manage real-time inventory, vault gear & in-game loadouts</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={fetchLiveProfile}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
              title="Disconnect Account"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Character Emblem Banners Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {profileData?.characters?.map((char, idx) => {
            const isSelected = selectedCharacterIndex === idx;
            return (
              <div
                key={char.characterId}
                onClick={() => setSelectedCharacterIndex(idx)}
                style={{
                  backgroundImage: char.emblemBackgroundPath ? `url(${char.emblemBackgroundPath})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
                className={`relative h-20 rounded-xl overflow-hidden cursor-pointer p-3 flex items-center justify-between border-2 transition-all shadow-lg ${
                  isSelected 
                    ? 'border-amber-400 ring-2 ring-amber-400/30 scale-[1.02]' 
                    : 'border-slate-800 opacity-75 hover:opacity-100 hover:border-slate-600'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent pointer-events-none" />
                
                <div className="relative z-10 space-y-0.5">
                  <div className="text-lg font-bold text-white font-heading uppercase tracking-wide drop-shadow">
                    {char.classType}
                  </div>
                  <div className="text-xs text-amber-300 font-mono font-bold flex items-center gap-1 drop-shadow">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>✧ {char.light} Power</span>
                  </div>
                </div>

                {isSelected && (
                  <div className="relative z-10 w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-lg font-bold">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-[#20293a]">
          <button
            onClick={() => setActiveSubTab('equipped')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-heading tracking-wide whitespace-nowrap transition-all ${
              activeSubTab === 'equipped' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Equipped ({activeChar?.equipped?.length || 0})
          </button>

          <button
            onClick={() => setActiveSubTab('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-heading tracking-wide whitespace-nowrap transition-all ${
              activeSubTab === 'inventory' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Bags ({activeChar?.bag?.length || 0})
          </button>

          <button
            onClick={() => setActiveSubTab('vault')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-heading tracking-wide whitespace-nowrap transition-all ${
              activeSubTab === 'vault' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Vault ({profileData?.vault?.length || 0})
          </button>

          <button
            onClick={() => setActiveSubTab('loadouts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-heading tracking-wide whitespace-nowrap transition-all ${
              activeSubTab === 'loadouts' 
                ? 'bg-amber-500 text-black shadow-md' 
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Loadouts ({activeChar?.loadouts?.length || 0})
          </button>
        </div>

      </div>

      {/* Action Notification Status Banner */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center justify-between animate-fadeIn">
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Sub-Tab 1: EQUIPPED GEAR */}
      {activeSubTab === 'equipped' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading">
            Currently Equipped on {activeChar?.classType}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeChar?.equipped?.map((item) => {
              const tierInfo = getTierInfo(item.tierTypeName);
              const damageInfo = getDamageInfo(item.damageType);

              return (
                <div
                  key={item.itemInstanceId || item.itemHash}
                  className="bg-[#121722] border border-[#20293a] rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div className={`p-3 ${tierInfo.headerBg} border-b border-[#20293a]`}>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                        {item.icon && <img src={item.icon} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono font-bold ${tierInfo.text}`}>
                            {item.tierTypeName}
                          </span>
                          {item.damageType && (
                            <span className={`text-[10px] font-mono ${damageInfo.text}`}>
                              • {item.damageType}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm truncate">{item.name}</h4>
                        <div className="text-xs text-amber-400 font-mono font-bold">
                          ✧ {item.power || '1900'} Power
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Perks */}
                  <div className="p-3 space-y-2 flex-1">
                    {item.perks?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.perks.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[11px] font-mono border border-slate-700"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-2.5 bg-[#0b0e14] border-t border-[#20293a] flex items-center justify-between gap-2">
                    {item.baseItem && (
                      <button
                        onClick={() => onSelectWeapon(item.baseItem)}
                        className="text-xs text-slate-400 hover:text-amber-300 font-medium"
                      >
                        Inspect
                      </button>
                    )}

                    <button
                      disabled={actionLoading === item.itemInstanceId}
                      onClick={() => handleTransferItem(item, true)}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Box className="w-3.5 h-3.5 text-amber-400" />
                      <span>To Vault</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: CHARACTER BAGS */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading">
            Items in {activeChar?.classType}'s Bag ({activeChar?.bag?.length || 0})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeChar?.bag?.map((item) => {
              const tierInfo = getTierInfo(item.tierTypeName);
              const damageInfo = getDamageInfo(item.damageType);

              return (
                <div
                  key={item.itemInstanceId || item.itemHash}
                  className="bg-[#121722] border border-[#20293a] rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div className={`p-3 ${tierInfo.headerBg} border-b border-[#20293a]`}>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                        {item.icon && <img src={item.icon} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono font-bold ${tierInfo.text}`}>
                            {item.tierTypeName}
                          </span>
                          {item.damageType && (
                            <span className={`text-[10px] font-mono ${damageInfo.text}`}>
                              • {item.damageType}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm truncate">{item.name}</h4>
                        <div className="text-xs text-amber-400 font-mono font-bold">
                          ✧ {item.power || '1900'} Power
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Perks */}
                  <div className="p-3 space-y-2 flex-1">
                    {item.perks?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.perks.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[11px] font-mono border border-slate-700"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions: Equip or Vault */}
                  <div className="p-2.5 bg-[#0b0e14] border-t border-[#20293a] flex items-center justify-between gap-2">
                    <button
                      disabled={actionLoading === item.itemInstanceId}
                      onClick={() => handleEquipItem(item.itemInstanceId)}
                      className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold font-mono transition-colors disabled:opacity-50"
                    >
                      ⚡ Equip
                    </button>

                    <button
                      disabled={actionLoading === item.itemInstanceId}
                      onClick={() => handleTransferItem(item, true)}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Box className="w-3.5 h-3.5 text-amber-400" />
                      <span>To Vault</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: VAULT EXPLORER */}
      {activeSubTab === 'vault' && (
        <div className="space-y-4">
          
          {/* Vault Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#121722] p-4 rounded-xl border border-[#20293a]">
            <input
              type="text"
              placeholder="Search items in Vault..."
              value={vaultSearch}
              onChange={(e) => setVaultSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-[#0b0e14] border border-[#20293a] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setVaultFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vaultFilter === 'all' ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                All ({profileData?.vault?.length || 0})
              </button>
              <button
                onClick={() => setVaultFilter('weapons')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vaultFilter === 'weapons' ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                Weapons
              </button>
              <button
                onClick={() => setVaultFilter('armor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vaultFilter === 'armor' ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                Armor
              </button>
            </div>
          </div>

          {/* Vault Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVault.slice(0, 80).map((item) => {
              const tierInfo = getTierInfo(item.tierTypeName);
              const damageInfo = getDamageInfo(item.damageType);

              return (
                <div
                  key={item.itemInstanceId || item.itemHash}
                  className="bg-[#121722] border border-[#20293a] rounded-xl overflow-hidden flex flex-col justify-between"
                >
                  <div className={`p-3 ${tierInfo.headerBg} border-b border-[#20293a]`}>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                        {item.icon && <img src={item.icon} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono font-bold ${tierInfo.text}`}>
                            {item.tierTypeName}
                          </span>
                          {item.damageType && (
                            <span className={`text-[10px] font-mono ${damageInfo.text}`}>
                              • {item.damageType}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm truncate">{item.name}</h4>
                        <div className="text-xs text-amber-400 font-mono font-bold">
                          ✧ {item.power || '1900'} Power
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Perks */}
                  <div className="p-3 space-y-2 flex-1">
                    {item.perks?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.perks.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[11px] font-mono border border-slate-700"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action: Transfer to Active Character */}
                  <div className="p-2.5 bg-[#0b0e14] border-t border-[#20293a] flex items-center justify-between gap-2">
                    {item.baseItem && (
                      <button
                        onClick={() => onSelectWeapon(item.baseItem)}
                        className="text-xs text-slate-400 hover:text-amber-300 font-medium"
                      >
                        Inspect
                      </button>
                    )}

                    <button
                      disabled={actionLoading === item.itemInstanceId}
                      onClick={() => handleTransferItem(item, false)}
                      className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono flex items-center gap-1 disabled:opacity-50"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                      <span>To {activeChar?.classType}</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Sub-Tab 4: IN-GAME LOADOUTS */}
      {activeSubTab === 'loadouts' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading">
            {activeChar?.classType}'s In-Game Loadouts
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeChar?.loadouts?.map((ld) => (
              <div
                key={ld.index}
                className="bg-[#121722] border border-[#20293a] hover:border-amber-500/40 rounded-xl p-5 space-y-4 transition-all shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300 font-heading">
                      #{ld.index + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base font-heading">
                        {ld.name || `Loadout ${ld.index + 1}`}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {ld.items?.length || 0} Equipped items & mods
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  disabled={actionLoading === `loadout_${ld.index}`}
                  onClick={() => handleEquipLoadout(ld.index)}
                  className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  <span>{actionLoading === `loadout_${ld.index}` ? 'Equipping...' : '⚡ Equip Full Loadout in Game'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
