import fs from 'fs';
import { db } from '../src/lib/db.js';

async function seedPlayers() {
  const lines = fs.readFileSync('oyuncular.txt', 'utf-8').split('\n');

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const [puuid, summonerName, tagline, region, tier, lp, lastChecked] = line.split('|');

    await db.query(`
      INSERT INTO players (puuid, current_summoner_name, current_tagline, region, tier, lp, last_checked_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (puuid) DO UPDATE SET
        current_summoner_name = EXCLUDED.current_summoner_name,
        tier = EXCLUDED.tier,
        lp   = EXCLUDED.lp
    `, [puuid, summonerName, tagline, region, tier, parseInt(lp), lastChecked]);

    console.log(`✓ Eklendi: ${summonerName}#${tagline} [${tier} ${lp} LP]`);
  }

  console.log('Seed tamamlandı.');
  process.exit(0);
}

seedPlayers();