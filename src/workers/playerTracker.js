import 'dotenv/config';
import cron from 'node-cron';
import { db } from '../lib/db.js';
import { riotPool } from '../lib/riotApiPool.js';
import { detectDodge } from './dodgeDetector.js';

const REGIONS = {
  TR1:  'https://tr1.api.riotgames.com',
  EUW1: 'https://euw1.api.riotgames.com',
  KR:   'https://kr.api.riotgames.com',
  NA1:  'https://na1.api.riotgames.com',
};

const ROUTING = {
  TR1:  'https://europe.api.riotgames.com',
  EUW1: 'https://europe.api.riotgames.com',
  KR:   'https://asia.api.riotgames.com',
  NA1:  'https://americas.api.riotgames.com',
};

async function checkPlayer(player) {
  const { puuid, region, current_summoner_name, tier, lp } = player;
  const base = REGIONS[region] || REGIONS.TR1;
  const routing = ROUTING[region] || ROUTING.TR1;

  // ADIM 1: Account bilgisi
  try {
    const accountData = await riotPool.fetch(
      `${routing}/riot/account/v1/accounts/by-puuid/${puuid}`
    );
    await checkNameChange(player, accountData);
  } catch (err) {
    console.error(`[Account] HATA: ${err.message}`);
    return;
  }

  // ADIM 2: Summoner bilgisi (profil ikonu için)
  let profileIconId = 0;
  try {
    const summoner = await riotPool.fetch(
      `${base}/lol/summoner/v4/summoners/by-puuid/${puuid}`
    );
    profileIconId = summoner.profileIconId || 0;
  } catch (err) {
    console.error(`[Summoner] HATA: ${err.message}`);
  }

  // ADIM 3: League bilgisi
  let soloQ;
  try {
    const leagues = await riotPool.fetch(
      `${base}/lol/league/v4/entries/by-puuid/${puuid}`
    );
    soloQ = leagues.find(l => l.queueType === 'RANKED_SOLO_5x5');
    if (!soloQ) return;
  } catch (err) {
    console.error(`[League] HATA: ${err.message}`);
    return;
  }

  // ADIM 4: LP güncelle
  try {
    const newLp = soloQ.leaguePoints;
    const newTier = soloQ.tier;
    const lpDelta = newLp - lp;

    if (lpDelta < 0 && Math.abs(lpDelta) <= 10) {
      await detectDodge(puuid, lp, newLp);
    }

    if (newLp !== lp || newTier !== tier) {
      // LP değişti
      const isWin = lpDelta > 0 && lpDelta > 10;
      const isLoss = lpDelta < 0 && lpDelta < -10;

      await db.query(`
        UPDATE players SET lp=$1, tier=$2, rank=$3, wins=$4, losses=$5, profile_icon_id=$6, last_checked_at=NOW()
        WHERE puuid=$7
      `, [newLp, newTier, soloQ.rank, soloQ.wins, soloQ.losses, profileIconId, puuid]);

      await db.query(`
        INSERT INTO daily_stats (puuid, stat_date, start_lp, start_tier, current_lp, current_tier, games_played, wins, losses)
        VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, 0, 0, 0)
        ON CONFLICT (puuid, stat_date) DO UPDATE SET
          current_lp   = $4,
          current_tier = $5,
          games_played = daily_stats.games_played + 1,
          wins         = daily_stats.wins + CASE WHEN $6 THEN 1 ELSE 0 END,
          losses       = daily_stats.losses + CASE WHEN $7 THEN 1 ELSE 0 END
      `, [puuid, newLp, newTier, newLp, newTier, isWin, isLoss]);

      console.log(`[LP] ${current_summoner_name}: ${lp} → ${newLp} (${lpDelta >= 0 ? '+' : ''}${lpDelta})`);
    } else {
      // LP değişmedi ama ikonu güncelle
      await db.query(`
        UPDATE players SET profile_icon_id=$1, last_checked_at=NOW() WHERE puuid=$2
      `, [profileIconId, puuid]);
    }
  } catch (err) {
    console.error(`[LP] HATA: ${err.message}`);
  }

  // ADIM 5: Canlı oyun
  await checkLiveGame(puuid, base, current_summoner_name);
}

async function checkNameChange(player, accountData) {
  const { puuid, current_summoner_name, current_tagline } = player;
  const newName = accountData.gameName;
  const newTagline = accountData.tagLine;

  if (newName !== current_summoner_name || newTagline !== current_tagline) {
    console.log(`[NameChange] ${current_summoner_name}#${current_tagline} → ${newName}#${newTagline}`);

    await db.query(`
      INSERT INTO name_history (puuid, old_name, old_tagline, new_name, new_tagline)
      VALUES ($1, $2, $3, $4, $5)
    `, [puuid, current_summoner_name, current_tagline, newName, newTagline]);

    await db.query(`
      UPDATE players SET current_summoner_name=$1, current_tagline=$2 WHERE puuid=$3
    `, [newName, newTagline, puuid]);
  }
}

async function checkLiveGame(puuid, base, name) {
  try {
    const liveGame = await riotPool.fetch(
      `${base}/lol/spectator/v5/active-games/by-puuid/${puuid}`
    );
    await db.query(`
      UPDATE players SET is_in_game=TRUE, live_game_id=$1 WHERE puuid=$2
    `, [String(liveGame.gameId), puuid]);
    console.log(`[LiveGame] ${name} şu an oyunda!`);
  } catch {
    await db.query(`
      UPDATE players SET is_in_game=FALSE, live_game_id=NULL WHERE puuid=$1
    `, [puuid]);
  }
}

// Cron: her dakika
cron.schedule('* * * * *', async () => {
  console.log(`\n[Tracker] Çalışıyor: ${new Date().toISOString()}`);
  const players = await db.query(`
    SELECT puuid, current_summoner_name, current_tagline, region, tier, lp
    FROM players
    WHERE tier IN ('CHALLENGER','GRANDMASTER','MASTER')
    ORDER BY lp DESC
  `);
  for (const p of players.rows) {
    await checkPlayer(p);
  }
});

// Günlük 00:00 snapshot
cron.schedule('0 0 * * *', async () => {
  console.log('[DailySnapshot] Başlatıldı');
  await db.query(`
    INSERT INTO daily_stats (puuid, stat_date, start_lp, start_tier, current_lp, current_tier)
    SELECT puuid, CURRENT_DATE, lp, tier, lp, tier
    FROM players
    WHERE tier IN ('CHALLENGER','GRANDMASTER','MASTER')
    ON CONFLICT (puuid, stat_date) DO NOTHING
  `);
  console.log('[DailySnapshot] Tamamlandı');
});

// Başlangıç testi
(async () => {
  console.log('[Başlangıç] İlk test çalışıyor...\n');
  const players = await db.query(`
    SELECT puuid, current_summoner_name, current_tagline, region, tier, lp
    FROM players
    WHERE tier IN ('CHALLENGER','GRANDMASTER','MASTER')
    ORDER BY lp DESC
    LIMIT 5
  `);
  for (const p of players.rows) {
    await checkPlayer(p);
  }
  console.log('\n[Başlangıç] İlk test bitti. Cron her dakika tekrar edecek...');
})();