import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  Sparkles, 
  Zap, 
  Sliders, 
  Check, 
  Flame, 
  ArrowRight, 
  Layers, 
  Cpu, 
  Lock, 
  Unlock, 
  RotateCcw,
  Box,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Award,
  Crosshair,
  Heart,
  Activity,
  Bomb,
  Swords
} from 'lucide-react';
import { getTierInfo } from '../utils/destiny-helpers';
import LongPressable from './LongPressable';

export default function ArmourOptimizer({
  activeChar,
  vault = [],
  onEquipItem,
  onTransferItem,
  onOpenInfo,
  onSelectArmor
}) {
  // Target Stat Points (0 to 200 Scale in the new system)
  const [targetStats, setTargetStats] = useState({
    weapons: 30,
    health: 100,
    classAbility: 80,
    grenade: 100,
    superAbility: 50,
    melee: 30
  });

  // Subclass Fragment Stat Modifiers (-20 to +40)
  const [fragmentBonus, setFragmentBonus] = useState({
    weapons: 0,
    health: 10,
    classAbility: 0,
    grenade: 0,
    superAbility: 0,
    melee: 0
  });

  const [assumeMasterwork, setAssumeMasterwork] = useState(true);
  const [assumeArtifice, setAssumeArtifice] = useState(false);
  const [selectedExoticHash, setSelectedExoticHash] = useState('any'); // 'any' | 'none' | itemHash (number)
  const [selectedArchetype, setSelectedArchetype] = useState('any'); // 'any' | 'Paragon' | 'Grenadier' | 'Specialist' | 'Brawler' | 'Bulwark' | 'Gunner'
  const [selectedSetFilter, setSelectedSetFilter] = useState('any'); // 'any' | 'artifice' | 'iron_banner' | 'raid' | 'moments_of_triumph'
  const [showSandboxGuide, setShowSandboxGuide] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildingStatus, setBuildingStatus] = useState(null);

  // New Destiny 2 Stat System (Frontiers / Armor System)
  const statMeta = [
    { 
      key: 'weapons', 
      label: 'Weapons', 
      short: 'WEAP', 
      color: 'text-sky-400', 
      bg: 'bg-sky-500/20', 
      border: 'border-sky-500/40', 
      desc: 'Increases weapon handling, reload speed, and Special/Heavy ammo drop frequency. (101-200: Bonus ammo brick size & handling perks)' 
    },
    { 
      key: 'health', 
      label: 'Health', 
      short: 'HLTH', 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-500/20', 
      border: 'border-emerald-500/40', 
      desc: 'Increases maximum shield health & reduces health regeneration start delay. (101-200: Overshield resilience & rapid regen)' 
    },
    { 
      key: 'classAbility', 
      label: 'Class', 
      short: 'CLAS', 
      color: 'text-amber-400', 
      bg: 'bg-amber-500/20', 
      border: 'border-amber-500/40', 
      desc: 'Reduces Class Ability cooldown (Hunter Dodge, Titan Barricade/Thruster, Warlock Rift). (101-200: Double class charge potential)' 
    },
    { 
      key: 'grenade', 
      label: 'Grenade', 
      short: 'GREN', 
      color: 'text-indigo-400', 
      bg: 'bg-indigo-500/20', 
      border: 'border-indigo-500/40', 
      desc: 'Accelerates Grenade ability recharge. (101-200: Grants a 2nd Grenade charge & empowered explosion radius)' 
    },
    { 
      key: 'superAbility', 
      label: 'Super', 
      short: 'SUPR', 
      color: 'text-purple-400', 
      bg: 'bg-purple-500/20', 
      border: 'border-purple-500/40', 
      desc: 'Accelerates Super generation from combat & passive time. (101-200: Bonus Super damage & faster orb generation)' 
    },
    { 
      key: 'melee', 
      label: 'Melee', 
      short: 'MELE', 
      color: 'text-rose-400', 
      bg: 'bg-rose-500/20', 
      border: 'border-rose-500/40', 
      desc: 'Accelerates Powered Melee ability recharge. (101-200: Grants a 2nd Melee charge & empowered melee damage)' 
    }
  ];

  // Stat Archetypes
  const archetypes = [
    { name: 'any', label: '🌐 Any Stat Archetype', desc: 'Search all gear combinations' },
    { name: 'Grenadier', label: '💣 Grenadier (Grenade / Super)', desc: 'Primary Grenade, Secondary Super' },
    { name: 'Paragon', label: '🌟 Paragon (Super / Melee)', desc: 'Primary Super, Secondary Melee' },
    { name: 'Specialist', label: '⚡ Specialist (Class / Weapons)', desc: 'Primary Class, Secondary Weapons' },
    { name: 'Brawler', label: '💥 Brawler (Melee / Health)', desc: 'Primary Melee, Secondary Health' },
    { name: 'Bulwark', label: '🛡️ Bulwark (Health / Class)', desc: 'Primary Health, Secondary Class' },
    { name: 'Gunner', label: '🔫 Gunner (Weapons / Grenade)', desc: 'Primary Weapons, Secondary Grenade' }
  ];

  // Presets
  const presets = [
    {
      name: '💣 Double Grenade & Health',
      desc: 'Grenadier Archetype (100+ Grenade / 100 Health / 80 Super)',
      stats: { weapons: 30, health: 100, classAbility: 60, grenade: 120, superAbility: 80, melee: 20 }
    },
    {
      name: '💥 Double Melee & Brawler',
      desc: 'Brawler Archetype (100+ Melee / 100 Health / 80 Class)',
      stats: { weapons: 20, health: 100, classAbility: 80, grenade: 30, superAbility: 40, melee: 120 }
    },
    {
      name: '🌟 Super Burst & Gunner',
      desc: 'Paragon / Gunner (100+ Super / 100 Weapons / 80 Grenade)',
      stats: { weapons: 100, health: 80, classAbility: 40, grenade: 80, superAbility: 110, melee: 30 }
    },
    {
      name: '🛡️ Max Health & Class Tank',
      desc: 'Bulwark Archetype (120+ Health / 100 Class / 60 Weapons)',
      stats: { weapons: 60, health: 120, classAbility: 100, grenade: 50, superAbility: 40, melee: 20 }
    }
  ];

  // Helper to extract clean armor slot name
  const getArmorSlotName = (item) => {
    if (item.bucketHash === 3448274439 || item.armorSlot?.toLowerCase().includes('helmet') || item.slot?.toLowerCase().includes('helmet')) return 'helmet';
    if (item.bucketHash === 3551901077 || item.armorSlot?.toLowerCase().includes('gauntlet') || item.slot?.toLowerCase().includes('gauntlet') || item.itemTypeDisplayName?.toLowerCase().includes('gauntlet') || item.itemTypeDisplayName?.toLowerCase().includes('arms')) return 'gauntlets';
    if (item.bucketHash === 1423949262 || item.armorSlot?.toLowerCase().includes('chest') || item.slot?.toLowerCase().includes('chest') || item.itemTypeDisplayName?.toLowerCase().includes('chest')) return 'chest';
    if (item.bucketHash === 20886954 || item.armorSlot?.toLowerCase().includes('leg') || item.slot?.toLowerCase().includes('leg') || item.itemTypeDisplayName?.toLowerCase().includes('leg')) return 'legs';
    if (item.bucketHash === 1585787867 || item.armorSlot?.toLowerCase().includes('class') || item.slot?.toLowerCase().includes('class') || item.itemTypeDisplayName?.toLowerCase().includes('class') || item.itemTypeDisplayName?.toLowerCase().includes('mark') || item.itemTypeDisplayName?.toLowerCase().includes('cloak') || item.itemTypeDisplayName?.toLowerCase().includes('bond')) return 'classItem';
    return null;
  };

  // Helper to get normalized armor stats from an item
  const getItemStats = (item) => {
    if (item.armorStats && typeof item.armorStats === 'object') {
      return {
        weapons: item.armorStats.weapons ?? item.armorStats.mobility ?? 0,
        health: item.armorStats.health ?? item.armorStats.resilience ?? 0,
        classAbility: item.armorStats.classAbility ?? item.armorStats.recovery ?? 0,
        grenade: item.armorStats.grenade ?? item.armorStats.discipline ?? 0,
        superAbility: item.armorStats.superAbility ?? item.armorStats.intellect ?? 0,
        melee: item.armorStats.melee ?? item.armorStats.strength ?? 0,
        total: item.armorStats.total || 0
      };
    }
    let weap = 0, hlth = 0, clas = 0, gren = 0, supr = 0, mele = 0;
    if (item.statsList) {
      item.statsList.forEach(s => {
        const n = s.name?.toLowerCase() || '';
        if (n.includes('weapon') || n.includes('mobility')) weap = s.value;
        else if (n.includes('health') || n.includes('resilience')) hlth = s.value;
        else if (n.includes('class') || n.includes('recovery')) clas = s.value;
        else if (n.includes('grenade') || n.includes('discipline')) gren = s.value;
        else if (n.includes('super') || n.includes('intellect')) supr = s.value;
        else if (n.includes('melee') || n.includes('strength')) mele = s.value;
      });
    }
    return {
      weapons: weap,
      health: hlth,
      classAbility: clas,
      grenade: gren,
      superAbility: supr,
      melee: mele,
      total: weap + hlth + clas + gren + supr + mele
    };
  };

  // Collect all owned armor for active character class
  const allOwnedArmor = useMemo(() => {
    if (!activeChar) return [];
    const charClass = activeChar.classType;
    const items = [];

    (activeChar.equipped || []).forEach(it => {
      if (it.isArmor) {
        const slot = getArmorSlotName(it);
        if (slot) items.push({ ...it, location: 'equipped', slotType: slot, stats: getItemStats(it) });
      }
    });

    (activeChar.bag || []).forEach(it => {
      if (it.isArmor) {
        const slot = getArmorSlotName(it);
        if (slot) items.push({ ...it, location: 'bag', slotType: slot, stats: getItemStats(it) });
      }
    });

    (vault || []).forEach(it => {
      if (it.isArmor) {
        const itemClass = it.classType || (it.itemTypeDisplayName?.includes('Titan') ? 'Titan' : it.itemTypeDisplayName?.includes('Hunter') ? 'Hunter' : it.itemTypeDisplayName?.includes('Warlock') ? 'Warlock' : null);
        if (!itemClass || itemClass === charClass) {
          const slot = getArmorSlotName(it);
          if (slot) items.push({ ...it, location: 'vault', slotType: slot, stats: getItemStats(it) });
        }
      }
    });

    return items;
  }, [activeChar, vault]);

  const availableExotics = useMemo(() => {
    const map = new Map();
    allOwnedArmor.forEach(it => {
      if (it.tierTypeName === 'Exotic') {
        const h = it.itemHash || it.id;
        if (!map.has(h)) map.set(h, it);
      }
    });
    return Array.from(map.values());
  }, [allOwnedArmor]);

  // Optimization Calculation
  const calculatedBuilds = useMemo(() => {
    if (allOwnedArmor.length === 0) return [];

    let filteredPool = allOwnedArmor;
    if (selectedSetFilter === 'artifice') {
      filteredPool = allOwnedArmor.filter(it => it.isArtifice || it.tierTypeName === 'Exotic');
    } else if (selectedSetFilter === 'iron_banner') {
      filteredPool = allOwnedArmor.filter(it => it.setName?.includes('Iron') || it.name?.includes('Iron') || it.tierTypeName === 'Exotic');
    } else if (selectedSetFilter === 'raid') {
      filteredPool = allOwnedArmor.filter(it => it.setCategory === 'Raids & Dungeons' || it.tierTypeName === 'Exotic');
    } else if (selectedSetFilter === 'moments_of_triumph') {
      filteredPool = allOwnedArmor.filter(it => it.setName?.includes('Triumph') || it.tierTypeName === 'Exotic');
    }

    const helmets = filteredPool.filter(it => it.slotType === 'helmet');
    const arms = filteredPool.filter(it => it.slotType === 'gauntlets');
    const chests = filteredPool.filter(it => it.slotType === 'chest');
    const legs = filteredPool.filter(it => it.slotType === 'legs');
    const classItems = filteredPool.filter(it => it.slotType === 'classItem');

    const dummyClass = classItems.length > 0 ? classItems : [{
      name: `${activeChar?.classType || ''} Class Item`,
      tierTypeName: 'Legendary',
      slotType: 'classItem',
      stats: { weapons: 0, health: 0, classAbility: 0, grenade: 0, superAbility: 0, melee: 0, total: 0 }
    }];

    const results = [];
    const topH = helmets.slice(0, 14);
    const topA = arms.slice(0, 14);
    const topC = chests.slice(0, 14);
    const topL = legs.slice(0, 14);
    const topCI = dummyClass.slice(0, 4);

    const targetW = targetStats.weapons || 0;
    const targetH = targetStats.health || 0;
    const targetC = targetStats.classAbility || 0;
    const targetG = targetStats.grenade || 0;
    const targetS = targetStats.superAbility || 0;
    const targetM = targetStats.melee || 0;

    const mwBonus = assumeMasterwork ? 10 : 0;

    for (const h of topH) {
      for (const a of topA) {
        for (const c of topC) {
          for (const l of topL) {
            for (const ci of topCI) {
              const pieces = [h, a, c, l, ci];
              const exoticsCount = pieces.filter(it => it.tierTypeName === 'Exotic').length;
              if (exoticsCount > 1) continue;

              if (selectedExoticHash === 'none' && exoticsCount > 0) continue;
              if (selectedExoticHash !== 'any' && selectedExoticHash !== 'none') {
                const hasSelectedExotic = pieces.some(it => String(it.itemHash || it.id) === String(selectedExoticHash));
                if (!hasSelectedExotic) continue;
              }

              // Base stats sum + Masterwork bonus + Fragment bonus
              const rawW = h.stats.weapons + a.stats.weapons + c.stats.weapons + l.stats.weapons + ci.stats.weapons + mwBonus + (fragmentBonus.weapons || 0);
              const rawH = h.stats.health + a.stats.health + c.stats.health + l.stats.health + ci.stats.health + mwBonus + (fragmentBonus.health || 0);
              const rawC = h.stats.classAbility + a.stats.classAbility + c.stats.classAbility + l.stats.classAbility + ci.stats.classAbility + mwBonus + (fragmentBonus.classAbility || 0);
              const rawG = h.stats.grenade + a.stats.grenade + c.stats.grenade + l.stats.grenade + ci.stats.grenade + mwBonus + (fragmentBonus.grenade || 0);
              const rawS = h.stats.superAbility + a.stats.superAbility + c.stats.superAbility + l.stats.superAbility + ci.stats.superAbility + mwBonus + (fragmentBonus.superAbility || 0);
              const rawM = h.stats.melee + a.stats.melee + c.stats.melee + l.stats.melee + ci.stats.melee + mwBonus + (fragmentBonus.melee || 0);

              // Deficits
              const defW = Math.max(0, targetW - rawW);
              const defH = Math.max(0, targetH - rawH);
              const defC = Math.max(0, targetC - rawC);
              const defG = Math.max(0, targetG - rawG);
              const defS = Math.max(0, targetS - rawS);
              const defM = Math.max(0, targetM - rawM);

              const actualArtificeCount = pieces.filter(it => it.isArtifice).length;
              const totalArtificeSlots = assumeArtifice ? 5 : actualArtificeCount;

              const modsNeeded = [];
              let modsCount = 0;

              const addModsForStat = (deficit, statName, shortName) => {
                let remaining = deficit;
                while (remaining > 5 && modsCount < 5) {
                  modsNeeded.push({ stat: statName, short: shortName, value: 10, label: `+10 ${statName}` });
                  remaining -= 10;
                  modsCount++;
                }
                if (remaining > 0 && modsCount < 5) {
                  modsNeeded.push({ stat: statName, short: shortName, value: 5, label: `+5 ${statName}` });
                  remaining -= 5;
                  modsCount++;
                }
                return Math.max(0, remaining);
              };

              let remW = addModsForStat(defW, 'Weapons', 'WEAP');
              let remH = addModsForStat(defH, 'Health', 'HLTH');
              let remC = addModsForStat(defC, 'Class', 'CLAS');
              let remG = addModsForStat(defG, 'Grenade', 'GREN');
              let remS = addModsForStat(defS, 'Super', 'SUPR');
              let remM = addModsForStat(defM, 'Melee', 'MELE');

              let artificeAssigned = 0;
              const artificeMods = [];
              const applyArtifice = (deficit, statName, shortName) => {
                let rem = deficit;
                while (rem > 0 && artificeAssigned < totalArtificeSlots) {
                  artificeMods.push({ stat: statName, short: shortName, value: 3, label: `+3 ${statName} (Artifice)` });
                  rem = Math.max(0, rem - 3);
                  artificeAssigned++;
                }
                return rem;
              };

              remW = applyArtifice(remW, 'Weapons', 'WEAP');
              remH = applyArtifice(remH, 'Health', 'HLTH');
              remC = applyArtifice(remC, 'Class', 'CLAS');
              remG = applyArtifice(remG, 'Grenade', 'GREN');
              remS = applyArtifice(remS, 'Super', 'SUPR');
              remM = applyArtifice(remM, 'Melee', 'MELE');

              const allAssignedMods = [...modsNeeded, ...artificeMods];
              const modWBonus = allAssignedMods.filter(m => m.short === 'WEAP').reduce((acc, m) => acc + m.value, 0);
              const modHBonus = allAssignedMods.filter(m => m.short === 'HLTH').reduce((acc, m) => acc + m.value, 0);
              const modCBonus = allAssignedMods.filter(m => m.short === 'CLAS').reduce((acc, m) => acc + m.value, 0);
              const modGBonus = allAssignedMods.filter(m => m.short === 'GREN').reduce((acc, m) => acc + m.value, 0);
              const modSBonus = allAssignedMods.filter(m => m.short === 'SUPR').reduce((acc, m) => acc + m.value, 0);
              const modMBonus = allAssignedMods.filter(m => m.short === 'MELE').reduce((acc, m) => acc + m.value, 0);

              const finalW = rawW + modWBonus;
              const finalH = rawH + modHBonus;
              const finalC = rawC + modCBonus;
              const finalG = rawG + modGBonus;
              const finalS = rawS + modSBonus;
              const finalM = rawM + modMBonus;

              const totalStatPoints = finalW + finalH + finalC + finalG + finalS + finalM;

              const isPerfectMatch = remW === 0 && remH === 0 && remC === 0 && remG === 0 && remS === 0 && remM === 0 &&
                finalW >= targetW &&
                finalH >= targetH &&
                finalC >= targetC &&
                finalG >= targetG &&
                finalS >= targetS &&
                finalM >= targetM;

              // Overcharged stats count (stats >= 100)
              const overchargedCount = [finalW, finalH, finalC, finalG, finalS, finalM].filter(v => v >= 100).length;

              results.push({
                pieces,
                stats: {
                  weapons: finalW,
                  health: finalH,
                  classAbility: finalC,
                  grenade: finalG,
                  superAbility: finalS,
                  melee: finalM
                },
                totalStatPoints,
                overchargedCount,
                modsNeeded: allAssignedMods,
                isPerfectMatch
              });
            }
          }
        }
      }
    }

    results.sort((a, b) => {
      if (a.isPerfectMatch && !b.isPerfectMatch) return -1;
      if (!a.isPerfectMatch && b.isPerfectMatch) return 1;
      if (b.overchargedCount !== a.overchargedCount) return b.overchargedCount - a.overchargedCount;
      return b.totalStatPoints - a.totalStatPoints;
    });

    return results.slice(0, 15);
  }, [allOwnedArmor, targetStats, fragmentBonus, assumeMasterwork, assumeArtifice, selectedExoticHash, selectedSetFilter, activeChar]);

  const handleApplyPreset = (preset) => {
    setTargetStats(preset.stats);
  };

  const handleStatChange = (statKey, delta) => {
    setTargetStats(prev => {
      const current = prev[statKey] || 0;
      const next = Math.max(0, Math.min(200, current + delta));
      return { ...prev, [statKey]: next };
    });
  };

  const handleFragmentChange = (statKey, val) => {
    setFragmentBonus(prev => ({
      ...prev,
      [statKey]: parseInt(val || 0, 10)
    }));
  };

  const handleEquipBuild = async (build) => {
    if (!build || isBuilding) return;
    setIsBuilding(true);
    setBuildingStatus('Equipping full armour set on Guardian...');

    try {
      for (const piece of build.pieces) {
        if (!piece.itemInstanceId) continue;

        if (piece.location === 'vault') {
          setBuildingStatus(`Transferring ${piece.name} from Vault...`);
          await onTransferItem?.(piece, false);
          await new Promise(r => setTimeout(r, 600));
        }

        setBuildingStatus(`Equipping ${piece.name}...`);
        await onEquipItem?.(piece.itemInstanceId);
        await new Promise(r => setTimeout(r, 400));
      }

      setBuildingStatus('⚡ Full Armour Build Equipped Successfully!');
    } catch (err) {
      setBuildingStatus('Error equipping build pieces');
    } finally {
      setIsBuilding(false);
      setTimeout(() => setBuildingStatus(null), 3500);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Banner & Sandbox Features */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#121722] to-indigo-500/15 border border-amber-500/30 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-heading tracking-wide">
                  Armour Stat Optimizer & Loadout Builder
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                  Frontiers 200 Stat System
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cross-references {allOwnedArmor.length} armour pieces across your {activeChar?.classType} (Equipped, Bag & Vault) across the 6 new stats (0–200 Scale)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-black/50 px-2.5 py-1.5 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={assumeMasterwork}
                onChange={(e) => setAssumeMasterwork(e.target.checked)}
                className="accent-amber-500 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span>Masterwork (+2 all)</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 cursor-pointer hover:border-indigo-500/50">
              <input
                type="checkbox"
                checked={assumeArtifice}
                onChange={(e) => setAssumeArtifice(e.target.checked)}
                className="accent-indigo-500 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span>+3 Artifice Slots</span>
            </label>

            <button
              onClick={() => setShowSandboxGuide(!showSandboxGuide)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Stat Benefits (0–200)</span>
            </button>
          </div>
        </div>

        {/* Current Sandbox Scaling Sheet */}
        {showSandboxGuide && (
          <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-amber-500/30 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-300 font-heading uppercase tracking-wider">
                Destiny 2 Frontiers New Stat System (0 to 200 Scale & Overcharge)
              </h4>
              <button onClick={() => setShowSandboxGuide(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
              {statMeta.map(st => (
                <div key={st.key} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-0.5">
                  <span className={`font-bold ${st.color}`}>{st.short} • {st.label}</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{st.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Presets Row */}
        <div className="pt-2 border-t border-white/5">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
            Quick Meta Presets (Overcharge 100+):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map((pr, idx) => (
              <button
                key={idx}
                onClick={() => handleApplyPreset(pr)}
                className="p-2 rounded-xl bg-[#0b0e14]/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left transition-all group"
              >
                <div className="text-xs font-bold text-slate-200 group-hover:text-amber-300 truncate font-heading">
                  {pr.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{pr.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Configuration Matrix: Target Stats & Exotic Lock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left: 6 Target Stat Steppers (0 to 200 Scale) */}
        <div className="lg:col-span-2 bg-[#121722] border border-[#20293a] rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#20293a] pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Target Stat Distribution (0–200 Scale)
            </h3>
            <span className="text-xs font-mono text-amber-400 font-bold">
              Target Total: {Object.values(targetStats).reduce((a, b) => a + b, 0)} Points
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {statMeta.map(st => {
              const currentVal = targetStats[st.key] || 0;
              const isOvercharged = currentVal >= 100;
              return (
                <div 
                  key={st.key}
                  className="p-3 rounded-xl bg-[#0b0e14] border border-[#20293a] flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold font-mono ${st.color}`}>
                        {st.short}
                      </span>
                      <span className="text-xs text-slate-300 font-medium">
                        {st.label}
                      </span>
                      {isOvercharged && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                          ⚡ 100+
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      Target: {currentVal} / 200
                    </div>
                  </div>

                  {/* Stepper Buttons (in steps of 10) */}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <button
                      onClick={() => handleStatChange(st.key, -10)}
                      disabled={currentVal <= 0}
                      className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                    >
                      -10
                    </button>
                    <span className="w-10 text-center font-mono font-bold text-sm text-white">
                      {currentVal}
                    </span>
                    <button
                      onClick={() => handleStatChange(st.key, 10)}
                      disabled={currentVal >= 200}
                      className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                    >
                      +10
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subclass Fragment Stat Tuning */}
          <div className="pt-2 border-t border-[#20293a]">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
              Subclass Fragment Stat Tuning:
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {statMeta.map(st => (
                <div key={st.key} className="space-y-0.5">
                  <span className={`text-[10px] font-mono font-bold ${st.color}`}>{st.short}</span>
                  <select
                    value={fragmentBonus[st.key] || 0}
                    onChange={(e) => handleFragmentChange(st.key, e.target.value)}
                    className="w-full bg-[#0b0e14] border border-slate-700 rounded-lg p-1 text-[11px] font-mono text-slate-200 text-center"
                  >
                    <option value="-20">-20</option>
                    <option value="-10">-10</option>
                    <option value="0">+0</option>
                    <option value="10">+10</option>
                    <option value="20">+20</option>
                    <option value="30">+30</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right: Exotic Armor Selection & Set Filter */}
        <div className="bg-[#121722] border border-[#20293a] rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#20293a] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Exotic & Set Filter
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {availableExotics.length} Exotics
              </span>
            </div>

            {/* Exotic Picker */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-mono block">Lock Specific Exotic:</label>
              <select
                value={selectedExoticHash}
                onChange={(e) => setSelectedExoticHash(e.target.value)}
                className="w-full bg-[#0b0e14] border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
              >
                <option value="any">✨ Any Exotic / Best Available</option>
                <option value="none">🛡️ No Exotic (Legendaries Only)</option>
                {availableExotics.map(ex => (
                  <option key={ex.itemHash || ex.id} value={ex.itemHash || ex.id}>
                    🟡 {ex.name} ({ex.itemTypeDisplayName || ex.slotType})
                  </option>
                ))}
              </select>
            </div>

            {/* Set Filter */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs text-slate-400 font-mono block">Armour Set Preference:</label>
              <select
                value={selectedSetFilter}
                onChange={(e) => setSelectedSetFilter(e.target.value)}
                className="w-full bg-[#0b0e14] border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
              >
                <option value="any">🌐 Any Armour Sets (Highest Stats)</option>
                <option value="artifice">💠 Prioritize Artifice Dungeon Sets</option>
                <option value="iron_banner">⚔️ Prioritize Iron Banner Sets (Iron Lord's Pride)</option>
                <option value="raid">🏆 Prioritize Raid / Dungeon Sets</option>
                <option value="moments_of_triumph">🌟 Prioritize Moments of Triumph Sets</option>
              </select>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed bg-[#0b0e14] p-3 rounded-xl border border-slate-800">
              Calculates combinations across your {activeChar?.classType}'s gear, solves optimal +10/+5 mods, factors in Masterwork bumps, and arranges 1-tap equips.
            </p>
          </div>

          <div className="text-xs font-mono text-amber-400 pt-2 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>{calculatedBuilds.length} Optimized Sets Found</span>
          </div>
        </div>

      </div>

      {/* Building Status Notification */}
      {buildingStatus && (
        <div className="p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold flex items-center gap-2 animate-fadeIn shadow-lg">
          <Zap className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{buildingStatus}</span>
        </div>
      )}

      {/* Generated Builds List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Optimized Armour Set Combinations ({calculatedBuilds.length})
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Ranked by target match & 100+ overcharge count
          </span>
        </div>

        {calculatedBuilds.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#121722] border border-[#20293a] text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
            <h4 className="text-base font-bold text-white font-heading">No Valid Builds Found</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Try reducing target stat requirements or changing the Exotic / Set filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {calculatedBuilds.map((build, bIdx) => (
              <div
                key={bIdx}
                className={`bg-[#121722] border rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl transition-all ${
                  build.isPerfectMatch 
                    ? 'border-amber-500/60 bg-gradient-to-r from-amber-500/5 via-[#121722] to-amber-500/5' 
                    : 'border-[#20293a] hover:border-slate-700'
                }`}
              >
                {/* Build Header: Total Stat Points Badge + 6 Stat Breakdown */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#20293a] pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-3 py-1 rounded-xl bg-amber-500 text-black font-heading font-bold text-sm tracking-wider shadow-md shadow-amber-500/20">
                      {build.totalStatPoints} Total Stat Points
                    </span>
                    {build.isPerfectMatch && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> 100% Target Match
                      </span>
                    )}
                    {build.overchargedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
                        ⚡ {build.overchargedCount} Overcharged (100+)
                      </span>
                    )}
                  </div>

                  {/* 6 Final Stat Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {statMeta.map(st => {
                      const val = build.stats[st.key] || 0;
                      const isOver = val >= 100;
                      return (
                        <span
                          key={st.key}
                          className={`text-xs font-mono px-2 py-0.5 rounded-md font-bold ${st.bg} ${st.color} border ${st.border} ${
                            isOver ? 'ring-1 ring-amber-400 shadow-sm' : ''
                          }`}
                        >
                          {st.short} {val}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* 5 Armor Pieces Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {build.pieces.map((piece, pIdx) => {
                    const tier = getTierInfo(piece.tierTypeName);
                    return (
                      <div
                        key={pIdx}
                        onClick={() => onSelectArmor?.(piece)}
                        className="p-2.5 rounded-xl bg-[#0b0e14] border border-slate-800 hover:border-amber-400 transition-all cursor-pointer space-y-2 group shadow-sm"
                      >
                        <div className="flex items-start gap-2">
                          <div className="relative w-10 h-10 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                            {piece.icon && (
                              <img src={piece.icon} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            )}
                            {piece.isArtifice && (
                              <div className="absolute top-0 right-0 w-3 h-3 bg-indigo-500 rounded-bl text-[7px] flex items-center justify-center font-bold text-white">
                                A
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={`text-[9px] font-mono font-bold uppercase block ${tier.text}`}>
                              {piece.tierTypeName}
                            </span>
                            <h5 className="text-xs font-bold text-white truncate group-hover:text-amber-300">
                              {piece.name}
                            </h5>
                          </div>
                        </div>

                        {/* Set Tag / Location Tag & Total Stat */}
                        <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-800/80">
                          <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                            piece.location === 'equipped' 
                              ? 'bg-emerald-500/20 text-emerald-300' 
                              : piece.location === 'bag' 
                                ? 'bg-sky-500/20 text-sky-300' 
                                : 'bg-purple-500/20 text-purple-300'
                          }`}>
                            {piece.location}
                          </span>
                          <span className="text-slate-300 font-bold">
                            Base: {piece.stats?.total || 0}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Required Mods Guide & Action Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                      Required Armour Stat & Artifice Mods:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {build.modsNeeded.length > 0 ? (
                        build.modsNeeded.map((mod, mIdx) => (
                          <span
                            key={mIdx}
                            className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                              mod.value === 3 
                                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40' 
                                : 'bg-slate-900 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            <Zap className="w-3 h-3 text-amber-400" />
                            {mod.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-mono text-emerald-400">
                          ✓ No Stat Mods required! Target met with raw armor stats.
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    disabled={isBuilding}
                    onClick={() => handleEquipBuild(build)}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold font-heading tracking-wide text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Equip Full Armour Build</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
}
