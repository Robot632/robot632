// Fetches Robot632's Roblox games and stats into roblox-stats.json.
//
// Roblox's web APIs don't allow browsers on other sites to read them
// (no CORS headers), so roblox.html can't ask Roblox directly. This
// script runs on GitHub (see .github/workflows/roblox-stats.yml),
// where that restriction doesn't apply, and the page reads the JSON
// it writes from the same site.
//
// Nothing is hand-picked: the games are whatever public games the
// group (GROUP_ID in roblox.html) has on Roblox, with their names,
// genres, thumbnails and stats. A new game shows up on the next run.
// If a request fails, the last good values are kept instead of being
// blanked.
//
//   node scripts/roblox-stats.mjs
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url);
const OUT = new URL('roblox-stats.json', ROOT);

const html = await readFile(new URL('roblox.html', ROOT), 'utf8');
const groupId = (html.match(/const GROUP_ID = (\d+)/) || [])[1];
if (!groupId) throw new Error('GROUP_ID not found in roblox.html');

let previous = {};
try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch {}
// older files kept games in an object keyed by place id
const previousGames = Array.isArray(previous.games)
  ? previous.games
  : Object.entries(previous.games || {}).map(([placeId, g]) => ({ placeId: Number(placeId), ...g }));

async function getJson(url){
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
let failures = 0;
const fail = (what, err) => { failures++; console.warn(`${what}: ${err.message}`); };

// ---------- 1. which games does the group have? ----------
// gamesV2 is the current endpoint; the older one is a fallback.
async function groupUniverses(){
  const endpoints = [
    `https://games.roblox.com/v2/groups/${groupId}/gamesV2?accessFilter=2&limit=50&sortOrder=Asc`,
    `https://games.roblox.com/v2/groups/${groupId}/games?accessFilter=2&limit=50&sortOrder=Asc`
  ];
  let lastErr;
  for (const base of endpoints){
    try{
      const found = [];
      let cursor = '';
      do {
        const page = await getJson(base + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''));
        for (const g of page.data || []) found.push({ universeId: g.id, placeId: g.rootPlace?.id });
        cursor = page.nextPageCursor;
      } while (cursor);
      return found;
    }catch(err){ lastErr = err; }
  }
  throw lastErr;
}

let universes;
try{
  universes = await groupUniverses();
  console.log(`group ${groupId}: ${universes.length} public game(s)`);
}catch(err){
  fail('group game list', err);
  universes = previousGames.map(g => ({ universeId: g.universeId, placeId: g.placeId }));
}

// ---------- 2. details + stats for each game ----------
const byUniverse = new Map(previousGames.map(g => [g.universeId, g]));
const details = new Map();
for (const ids of chunks(universes.map(u => u.universeId), 50)){
  try{
    const res = await getJson(`https://games.roblox.com/v1/games?universeIds=${ids.join(',')}`);
    for (const d of res.data || []) details.set(d.id, d);
  }catch(err){ fail('game details', err); }
}

// ---------- 3. thumbnails ----------
const thumbs = new Map();
for (const ids of chunks(universes.map(u => u.universeId), 50)){
  try{
    const res = await getJson(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${ids.join(',')}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`);
    for (const t of res.data || []){
      const img = (t.thumbnails || []).find(x => x.state === 'Completed');
      if (img) thumbs.set(t.universeId, img.imageUrl);
    }
  }catch(err){ fail('thumbnails', err); }
}

function genreOf(d){
  const parts = [d.genre_l1, d.genre_l2].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return d.genre && d.genre !== 'All' ? d.genre : '';
}

const games = universes.map(({ universeId, placeId }) => {
  const d = details.get(universeId);
  const old = byUniverse.get(universeId) || {};
  if (!d) return { ...old, universeId, placeId: placeId ?? old.placeId };
  return {
    universeId,
    placeId: d.rootPlaceId ?? placeId,
    name: d.name,
    genre: genreOf(d),
    description: d.description,
    thumbnail: thumbs.get(universeId) || old.thumbnail || null,
    visits: d.visits,
    favoritedCount: d.favoritedCount,
    playing: d.playing,
    created: d.created,
    updated: d.updated
  };
}).filter(g => g.placeId && g.name);

// ---------- 4. the group itself ----------
let group = previous.group ?? null;
let groupFetched = false;
try{
  const g = await getJson(`https://groups.roblox.com/v1/groups/${groupId}`);
  group = { ...(group || {}), id: Number(groupId), name: g.name, memberCount: g.memberCount };
  groupFetched = true;
}catch(err){ fail('group', err); }
try{
  const icon = (await getJson(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=150x150&format=Png&isCircular=false`)).data?.[0];
  if (icon && icon.state === 'Completed') group = { ...(group || { id: Number(groupId) }), iconUrl: icon.imageUrl };
}catch(err){ fail('group icon', err); }

const gotSomething = details.size > 0 || groupFetched;
const out = {
  // only move the timestamp forward when something was actually fetched
  fetchedAt: gotSomething ? new Date().toISOString() : (previous.fetchedAt ?? null),
  group,
  games
};
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`${games.length} game(s) written, ${failures} failed request(s)`);
if (!gotSomething) process.exitCode = 1;
