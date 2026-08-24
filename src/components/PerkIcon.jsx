import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * A perk's icon, with the name carried in `alt` rather than shown on screen.
 *
 * Perk icons are hosted on bungie.net, so a definition can name an icon that
 * does not load -- an offline session, a blocked host, a stale URL. Without a
 * fallback the grid fills with broken-image glyphs, which read as a bug rather
 * than a missing asset, so a failed load falls back to the same placeholder a
 * perk with no icon at all gets.
 */
export default function PerkIcon({ perk, className = 'w-6 h-6' }) {
  const [failed, setFailed] = useState(false);
  const name = perk?.name || 'Perk';

  if (!perk?.icon || failed) {
    return <Sparkles className={`${className} text-amber-400 p-0.5`} role="img" aria-label={name} />;
  }

  return (
    <img
      src={perk.icon}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover`}
    />
  );
}
