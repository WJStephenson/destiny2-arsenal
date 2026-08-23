export const STAT_DESCRIPTIONS = {
  'Impact': {
    name: 'Impact',
    category: 'Weapon Stat',
    icon: '💥',
    description: 'Determines base damage dealt per bullet, pellet, or projectile. Higher impact deals more damage per shot and higher stagger against combatants.',
    tips: 'Critical hit multipliers and damage falloff scale with the weapon archetype\'s base impact.'
  },
  'Range': {
    name: 'Range',
    category: 'Weapon Stat',
    icon: '🎯',
    description: 'Increases the distance before damage falloff begins, increases zoom accuracy, bullet magnetism falloff distance, and projectile velocity.',
    tips: 'On Hand Cannons, Shotguns, and SMGs, Range is one of the most critical stats for landing consistent critical hits at distance.'
  },
  'Stability': {
    name: 'Stability',
    category: 'Weapon Stat',
    icon: '⚖️',
    description: 'Reduces weapon kick/recoil per shot, decreases reticle bounce, and significantly reduces flinch taken when taking damage from enemies.',
    tips: 'High stability keeps your crosshair on target during sustained rapid-fire duels.'
  },
  'Handling': {
    name: 'Handling',
    category: 'Weapon Stat',
    icon: '⚡',
    description: 'Determines weapon ready speed (draw time), stow speed (holster time), and Aim Down Sights (ADS) transition speed.',
    tips: 'Crucial for fast weapon swapping, defensive quick-draws, and snappier target acquisition.'
  },
  'Reload Speed': {
    name: 'Reload Speed',
    category: 'Weapon Stat',
    icon: '🔄',
    description: 'Reduces the time required to reload magazine or battery from empty or tactical reload.',
    tips: 'Reload speed is capped at 100 stat points, corresponding to the fastest possible base animation.'
  },
  'Rounds Per Minute': {
    name: 'Rounds Per Minute (RPM)',
    category: 'Weapon Stat',
    icon: '⏱️',
    description: 'The rate of fire at which the weapon discharges ammunition continuously.',
    tips: 'Dictated by the weapon\'s intrinsic archetype frame (e.g. 140 RPM vs 120 RPM Hand Cannons).'
  },
  'Aim Assistance': {
    name: 'Aim Assistance',
    category: 'Hidden Stat',
    icon: '👁️',
    description: 'Increases reticle stickiness on controller and expands the bullet magnetism cone on both mouse and controller, allowing shots close to the target to register as hits.',
    tips: 'Higher aim assist makes landing critical headshots much more forgiving.'
  },
  'Airborne Effectiveness': {
    name: 'Airborne Effectiveness (AE)',
    category: 'Hidden Stat',
    icon: '🦅',
    description: 'Reduces in-air accuracy penalties, in-air aim assist degradation, and projectile cone expansion while jumping, airborne, or gliding.',
    tips: 'At 60+ AE, weapons behave with almost ground-level accuracy while jumping.'
  },
  'Recoil Direction': {
    name: 'Recoil Direction',
    category: 'Hidden Stat',
    icon: '⬆️',
    description: 'Controls the verticality and left/right deviation of weapon kick. Values ending in 5 (e.g. 65, 75, 85, 95, 100) produce vertical recoil.',
    tips: 'Values ending in 0 kick heavily left or right. Use Counterbalance Stock (+15) or Arrowhead Brake (+30) to achieve vertical recoil.'
  },
  'Magazine': {
    name: 'Magazine Size',
    category: 'Weapon Stat',
    icon: '📦',
    description: 'The maximum capacity of rounds or charges loaded into the weapon ready to fire before needing a reload.',
    tips: 'Can be enhanced with Backup Mag, Extended Mag, or Tactical Mag.'
  },
  'Zoom': {
    name: 'Zoom Magnification',
    category: 'Hidden Stat',
    icon: '🔭',
    description: 'Magnifies the field of view when aiming down sights and pushes damage falloff further into the distance.',
    tips: 'Higher zoom grants extra effective range and tighter accuracy cones.'
  }
};

export const ELEMENT_DESCRIPTIONS = {
  'Solar': {
    name: 'Solar Damage',
    category: 'Subclass Element',
    icon: '🔥',
    color: '#f16c24',
    description: 'Harnesses intense heat and radiant energy. Triggers subclass 3.0 keywords like Scorch (damage over time), Ignition (massive solar explosion), Cure, and Radiant (25% weapon damage buff).',
    synergies: 'Pairs with perks like Incandescent, Heal Clip, and Dawnblade/Solar Titan/Gunslinger fragments.'
  },
  'Arc': {
    name: 'Arc Damage',
    category: 'Subclass Element',
    icon: '⚡',
    color: '#79b9e7',
    description: 'Channels raw electric current and conductivity. Triggers subclass 3.0 keywords like Jolt (chaining lightning to nearby enemies), Blind (disorienting enemies), and Amplified (movement and weapon handling boost).',
    synergies: 'Pairs with perks like Voltshot, Eddy Current, and Arc fragment chains.'
  },
  'Void': {
    name: 'Void Damage',
    category: 'Subclass Element',
    icon: '🔮',
    color: '#b184c5',
    description: 'Bends space-time and gravitational cosmic vacuum. Triggers subclass 3.0 keywords like Volatile (enemies explode upon taking damage), Weaken (15% more damage taken), Suppress, and Devour (instant full health on kill).',
    synergies: 'Pairs with Destabilizing Rounds, Repulsor Brace, and Void siphon builds.'
  },
  'Stasis': {
    name: 'Stasis Damage',
    category: 'Subclass Element',
    icon: '❄️',
    color: '#4d88ff',
    description: 'Cosmic ice and thermodynamic stillness. Triggers subclass 3.0 keywords like Slow (reduces speed and accuracy), Freeze (encases targets solid), and Shatter (detonates frozen targets for high AoE damage).',
    synergies: 'Pairs with Headstone, Chill Clip, and Stasis Shard loops.'
  },
  'Strand': {
    name: 'Strand Damage',
    category: 'Subclass Element',
    icon: '🍃',
    color: '#35e385',
    description: 'Taps into the cosmic web of consciousness and psychic threads. Triggers subclass 3.0 keywords like Suspend (lifts targets helplessly into the air), Sever (targets deal 40% less damage), Unravel, and Threadlings.',
    synergies: 'Pairs with Hatchling, Slice, Thread of Generation, and Warlock Broodweaver.'
  },
  'Kinetic': {
    name: 'Kinetic Damage',
    category: 'Weapon Slot',
    icon: '⚪',
    color: '#e2e8f0',
    description: 'Deals 10% more unshielded base damage on Primary weapons and 15% more base damage on Special weapons compared to elemental energy weapons.',
    synergies: 'Pairs with Kinetic Tremors, Firefly, and Osmosis.'
  }
};
