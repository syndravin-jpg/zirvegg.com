import { db } from '../src/lib/db.js';
import { riotPool } from '../src/lib/riotApiPool.js';

const REGION = 'TR1';
const BASE = 'https://tr1.api.riotgames.com';
const ROUTING = 'https://europe.api.riotgames.com';

const TIERS = [
  { name: 'CHALLENGER',  endpoint: '/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5' },
  { name: 'GRANDMASTER', endpoint: '/lol/league/v4/grandmasterleagues/by-queue/RANKED_SOLO_5x5' },
  { name: 'MASTER',      endpoint: '/lol/league/v4/masterleagues/by-queue/RANKED_SOLO_5x5' },
];

async function importTier(tier) {
  console.log(`\n[${tier.name}] Liste çekiliyor...`);
  const league = await riotPool.fetch(`${BASE}${tier.endpoint}`);
  console.log(`[${tier.name}] ${league.entries.length} oyuncu bulundu.`);

  let added = 0, skipped = 0;

  for (const entry of league.entries) {
    try {
      // Account API'den gameName ve tagLine al
      const account = await riotPool.fetch(
        `${ROUTING}/riot/account/v1/accounts/by-puuid/${entry.puuid}`
      );

      await db.query(`
        INSERT INTO players (puuid, current_summoner_name, current_tagline, region, tier, rank, lp, wins, losses)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (puuid) DO UPDATE SET
          current_summoner_name = EXCLUDED.current_summoner_name,
          current_tagline       = EXCLUDED.current_tagline,
          tier  = EXCLUDED.tier,
          rank  = EXCLUDED.rank,
          lp    = EXCLUDED.lp,
          wins  = EXCLUDED.wins,
          losses = EXCLUDED.losses
      `, [
        entry.puuid,
        account.gameName,
        account.tagLine,
        REGION,
        tier.name,
        entry.rank || 'I',
        entry.leaguePoints,
        entry.wins,
        entry.losses,
      ]);

      added++;
      if (added % 20 === 0) {
        console.log(`[${tier.name}] ${added}/${league.entries.length} eklendi...`);
      }
    } catch (err) {
      skipped++;
      console.error(`[${tier.name}] Atlandı (${entry.puuid.substring(0, 12)}...): ${err.message}`);
    }
  }

  console.log(`[${tier.name}] ✓ Tamamlandı. Eklenen: ${added}, Atlanan: ${skipped}`);
}

(async () => {
  console.log('═══ LoL Yüksek Elo İçeri Aktarma ═══');
  console.log(`Bölge: ${REGION}\n`);

  for (const tier of TIERS) {
    await importTier(tier);
  }

  console.log('\n═══ TÜM İŞLEMLER TAMAMLANDI ═══');
  process.exit(0);
})();