import { batchResolveItemDefinitions } from './item-definition-cache';
import { getPlugSetItemHashes } from './definition-api';
import { runInventoryAction } from './destiny-inventory-actions';

/**
 * A Guardian's subclass, as something the app can read and change.
 *
 * Everything on a subclass -- the Super, the three abilities, the Aspects and
 * the Fragments -- is a plug sitting in one of the subclass item's sockets.
 * Changing any of them is the same action with a different socket index, so
 * this module's whole job is to say which socket is which, what may go in it,
 * and how to put it there.
 */

/** What each kind of socket is called on screen. */
export const ROLE_LABELS = Object.freeze({
  super: 'Super',
  classAbility: 'Class Ability',
  movement: 'Movement',
  melee: 'Melee',
  grenade: 'Grenade',
  aspect: 'Aspect',
  fragment: 'Fragment',
  other: 'Other'
});

/**
 * What a plug is, from its category identifier.
 *
 * Bungie's identifiers read like `hunter.arc.aspects`, `warlock.solar.supers`
 * or `shared.stasis.fragments`, so the last segment is the answer. The display
 * name is the fallback for anything that arrives without one.
 */
export function classifyPlug(def) {
  if (!def) return null;

  const id = (def.plugCategoryIdentifier || '').toLowerCase();
  if (id) {
    if (id.includes('fragments')) return 'fragment';
    if (id.includes('aspects')) return 'aspect';
    if (id.includes('supers')) return 'super';
    if (id.includes('class_abilities')) return 'classAbility';
    if (id.includes('movement')) return 'movement';
    if (id.includes('melee')) return 'melee';
    if (id.includes('grenades')) return 'grenade';
  }

  const typeName = (def.itemTypeDisplayName || '').toLowerCase();
  if (typeName.includes('fragment')) return 'fragment';
  if (typeName.includes('aspect')) return 'aspect';
  if (typeName.includes('super')) return 'super';
  if (typeName.includes('class ability')) return 'classAbility';
  if (typeName.includes('movement')) return 'movement';
  if (typeName.includes('melee')) return 'melee';
  if (typeName.includes('grenade')) return 'grenade';

  return null;
}

/** An empty Aspect or Fragment socket, which the game fills with a placeholder plug. */
export function isEmptyPlug(def) {
  const name = (def?.name || '').toLowerCase();
  return name.includes('empty') || name.includes('locked');
}

/**
 * The plug options the live profile reports for one subclass instance.
 *
 * Bungie describes the same thing in three places and does not always send all
 * three, so each is tried in turn:
 *   1. the item's own reusable plugs, which is exactly what this instance can
 *      take right now;
 *   2. the profile's or character's plug sets, which say what the player owns;
 *   3. the socket's plug set in the manifest, which says what exists at all.
 * The first two reflect ownership, so a Fragment that has not been unlocked
 * never shows up as available; the third is only reached when neither arrived.
 */
export function collectSocketOptionHashes({
  socketIndex,
  socketEntry,
  reusablePlugs,
  profilePlugSets,
  characterPlugSets
}) {
  const fromItem = reusablePlugs?.[socketIndex];
  if (fromItem?.length) {
    return fromItem
      .filter(p => p.enabled !== false || p.canInsert !== false)
      .map(p => p.plugItemHash);
  }

  const plugSetHash = socketEntry?.reusablePlugSetHash ?? socketEntry?.randomizedPlugSetHash;
  if (plugSetHash) {
    const fromSets = characterPlugSets?.[plugSetHash] || profilePlugSets?.[plugSetHash];
    if (fromSets?.length) {
      return fromSets
        .filter(p => p.canInsert !== false || p.enabled !== false)
        .map(p => p.plugItemHash);
    }
  }

  if (socketEntry?.reusablePlugItems?.length) return [...socketEntry.reusablePlugItems];

  return [];
}

/**
 * Build the editable model of one subclass.
 *
 * Only the plugs that are actually fitted are resolved here. A subclass offers
 * a few hundred options across its sockets and every one of them is a separate
 * request to Bungie, so the option lists stay as hashes until a player opens
 * the socket they belong to.
 */
export async function buildSubclassModel({
  item,
  liveSockets,
  reusablePlugs,
  profilePlugSets,
  characterPlugSets,
  socketEntries
}) {
  if (!item) return null;

  const sockets = liveSockets || [];
  const fittedHashes = sockets.map(s => s.plugHash).filter(Boolean);
  const fittedDefs = await batchResolveItemDefinitions(fittedHashes);

  const built = sockets.map((socket, index) => {
    const entry = socketEntries?.[index] || null;
    const plugDef = socket.plugHash ? fittedDefs[socket.plugHash] : null;

    const optionHashes = collectSocketOptionHashes({
      socketIndex: index,
      socketEntry: entry,
      reusablePlugs,
      profilePlugSets,
      characterPlugSets
    });

    // An empty Fragment socket's placeholder plug says nothing about what the
    // socket is for, so the socket's own initial plug -- the one the manifest
    // names for it -- settles the role when the fitted plug cannot.
    const role = classifyPlug(plugDef)
      || classifyPlug(fittedDefs[entry?.singleInitialItemHash])
      || null;

    return {
      index,
      role,
      isVisible: socket.isVisible !== false,
      isEnabled: socket.isEnabled !== false,
      plugHash: socket.plugHash || null,
      plug: plugDef
        ? {
          hash: socket.plugHash,
          name: plugDef.name,
          icon: plugDef.icon,
          description: plugDef.description,
          isEmpty: isEmptyPlug(plugDef)
        }
        : null,
      optionHashes,
      // Kept so a role that only its options can explain -- an empty socket
      // whose initial plug is a placeholder too -- can still be resolved.
      singleInitialItemHash: entry?.singleInitialItemHash ?? null,
      plugSetHash: entry?.reusablePlugSetHash ?? entry?.randomizedPlugSetHash ?? null
    };
  });

  return deriveModel({
    itemInstanceId: item.itemInstanceId,
    itemHash: item.itemHash,
    name: item.name,
    icon: item.icon,
    screenshot: item.screenshot || null,
    damageType: item.damageType || null
  }, built);
}

/**
 * The views the screens read -- the Super, the abilities, the Aspects, the
 * Fragments -- all of which are the same socket list grouped by role.
 *
 * Derived rather than stored, so a socket that changes only has to be replaced
 * once and every view of it follows.
 */
function deriveModel(identity, sockets) {
  // Sockets the game hides are not part of the build (they hold tracking and
  // display plugs), and one with nothing to put in it cannot be edited.
  const editable = sockets.filter(s => s.isVisible && s.role);

  const byRole = {};
  editable.forEach(socket => {
    if (!byRole[socket.role]) byRole[socket.role] = [];
    byRole[socket.role].push(socket);
  });

  return {
    ...identity,
    sockets,
    editableSockets: editable,
    byRole,
    super: byRole.super?.[0] || null,
    aspects: byRole.aspect || [],
    fragments: byRole.fragment || [],
    abilities: [
      ...(byRole.classAbility || []),
      ...(byRole.movement || []),
      ...(byRole.melee || []),
      ...(byRole.grenade || [])
    ]
  };
}

/**
 * The model as it will look once a plug lands, so the tile changes under the
 * thumb rather than after the next profile read. Bungie's verdict still decides
 * -- a rejected change is rolled back to the model this returned from.
 */
export function applyPlugToModel(model, socketIndex, plug) {
  if (!model) return model;

  const { sockets, ...identity } = model;
  const next = sockets.map(socket => {
    if (socket.index !== socketIndex) return socket;
    return {
      ...socket,
      plugHash: plug.hash,
      plug: {
        hash: plug.hash,
        name: plug.name,
        icon: plug.icon,
        description: plug.description,
        isEmpty: !!plug.isEmpty
      }
    };
  });

  // The identity fields are the model's own; the grouped views are rebuilt.
  delete identity.editableSockets;
  delete identity.byRole;
  delete identity.super;
  delete identity.aspects;
  delete identity.fragments;
  delete identity.abilities;

  return deriveModel(identity, next);
}

/**
 * The options for one socket, as definitions, resolved on demand.
 *
 * When the live profile listed nothing for the socket, the socket's plug set in
 * the manifest is read instead -- that is the only route left for a profile
 * that arrived without plug sets, and without it the picker opens empty.
 */
export async function resolveSocketOptions(socket) {
  if (!socket) return [];

  let hashes = socket.optionHashes || [];
  if (!hashes.length && socket.plugSetHash) {
    hashes = await getPlugSetItemHashes(socket.plugSetHash);
  }
  if (!hashes.length && socket.plugHash) hashes = [socket.plugHash];

  const defs = await batchResolveItemDefinitions(hashes);

  return hashes
    .map(hash => {
      const def = defs[hash];
      if (!def) return null;
      return {
        hash,
        name: def.name,
        icon: def.icon,
        description: def.description,
        isEmpty: isEmptyPlug(def),
        role: classifyPlug(def)
      };
    })
    .filter(Boolean);
}

/**
 * Put a plug into one of an item's sockets.
 *
 * This is Bungie's "free" insertion, the one that covers subclass plugs and
 * armour mods; it needs no action token, but it does need the app's OAuth
 * registration to carry Advanced Write Actions. When it does not, Bungie says
 * so and the message is passed straight through rather than guessed at.
 */
export async function insertPlug({
  membershipType,
  characterId,
  itemInstanceId,
  socketIndex,
  plugItemHash
}) {
  if (!membershipType || !characterId || !itemInstanceId || plugItemHash === undefined) {
    return { ok: false, message: 'Missing details for that change.' };
  }

  return runInventoryAction({
    proxyPath: '/api/inventory/insert-plug',
    proxyBody: { membershipType, characterId, itemInstanceId, socketIndex, plugItemHash },
    directUrl: 'https://www.bungie.net/Platform/Destiny2/Actions/Items/InsertSocketPlugFree/',
    directBody: {
      plug: {
        socketIndex,
        socketArrayType: 0,
        plugItemHash
      },
      itemId: itemInstanceId,
      characterId,
      membershipType
    }
  });
}

/**
 * Name and icon for a plug hash out of a loadout, for display only.
 * Loadouts store their subclass configuration as bare hashes.
 */
export async function describePlugs(hashes) {
  const defs = await batchResolveItemDefinitions(hashes || []);
  return (hashes || []).map(hash => {
    const def = defs[hash];
    if (!def) return null;
    return {
      hash,
      name: def.name,
      icon: def.icon,
      description: def.description,
      role: classifyPlug(def),
      isEmpty: isEmptyPlug(def)
    };
  }).filter(p => p && !p.isEmpty);
}
