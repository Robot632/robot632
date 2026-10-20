// Fetches Robot632's Roblox stats into roblox-stats.json.
//
// Roblox's web APIs don't allow browsers on other sites to read them
// (no CORS headers), so roblox.html can't ask Roblox directly. This
// script runs on GitHub (see .github/workflows/roblox-stats.yml),
// where that restriction doesn't apply, and the page reads the JSON
// it writes from the same site.
//
// The games and group come from roblox.html itself (data-place-id on
// each project card, GROUP_ID in its script), so adding a game there
// is all it takes. If one request fails, that entry keeps its last
// good values instead of being blanked.
//
//   node scripts/roblox-stats.mjs
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url);
const OUT = new URL('roblox-stats.json', ROOT);

const html = await readFile(new URL('roblox.html', ROOT), 'utf8');
const placeIds = [...new Set([...html.matchAll(/data-place-id="(\d+)"/g)].map(m => m[1]))];
const groupId = (html.match(/const GROUP_ID = (\d+)/) || [])[1];

let previous = { games: {}, group: null };
try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch {}

async function getJson(url){
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const games = {};
let failures = 0;

for (const placeId of placeIds){
  try{
    const old = previous.games?.[placeId];
    const universeId = old?.universeId ??
      (await getJson(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`)).universeId;
    const data = (await getJson(`https://games.roblox.com/v1/games?universeIds=${universeId}`)).data?.[0];
    if (!data) throw new Error(`no game data for universe ${universeId}`);
    games[placeId] = {
      universeId,
      name: data.name,
      visits: data.visits,
      favoritedCount: data.favoritedCount,
      playing: data.playing,
      created: data.created,
      updated: data.updated,
      description: data.description
    };
  }catch(err){
    failures++;
    console.warn(`place ${placeId}: ${err.message}`);
    if (previous.games?.[placeId]) games[placeId] = previous.games[placeId];
  }
}

let group = previous.group ?? null;
if (groupId){
  try{
    const g = await getJson(`https://groups.roblox.com/v1/groups/${groupId}`);
    group = { id: Number(groupId), memberCount: g.memberCount };
  }catch(err){
    failures++;
    console.warn(`group ${groupId}: ${err.message}`);
  }
}

const allFailed = failures === placeIds.length + (groupId ? 1 : 0);
const out = {
  // only move the timestamp forward when something was actually fetched
  fetchedAt: allFailed ? (previous.fetchedAt ?? null) : new Date().toISOString(),
  group,
  games
};
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`${placeIds.length} games, ${failures} failed request(s)`);
if (allFailed) process.exitCode = 1;
