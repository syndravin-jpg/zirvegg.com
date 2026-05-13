import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { db } from './lib/db.js';

const fastify = Fastify({ logger: true });
await fastify.register(cors, { origin: '*' });

// ─────────────────────────────────────────
// 1. Tüm oyuncular (leaderboard)
// ─────────────────────────────────────────
fastify.get('/api/players', async (req, reply) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 100;
  const offset = (page - 1) * limit;

  const result = await db.query(`
    SELECT puuid, current_summoner_name, current_tagline, tier, rank, lp, wins, losses, is_in_game, profile_icon_id
    FROM players
    WHERE tier IN ('CHALLENGER','GRANDMASTER','MASTER')
    ORDER BY lp DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  const countRes = await db.query(`
    SELECT COUNT(*) AS total FROM players
    WHERE tier IN ('CHALLENGER','GRANDMASTER','MASTER')
  `);

  return {
    data: result.rows,
    page,
    totalPages: Math.ceil(parseInt(countRes.rows[0].total) / limit),
    totalPlayers: parseInt(countRes.rows[0].total),
  };
});

// ─────────────────────────────────────────
// 2. Günün en çok LP kazananları
// ─────────────────────────────────────────
fastify.get('/api/leaderboard/gainers', async (req, reply) => {
  const result = await db.query(`
    SELECT
      p.puuid,
      p.current_summoner_name || '#' || p.current_tagline AS display_name,
      p.tier, p.lp, p.is_in_game, p.profile_icon_id,
      ds.start_lp, ds.current_lp, ds.lp_change, ds.games_played
    FROM daily_stats ds
    JOIN players p ON p.puuid = ds.puuid
    WHERE ds.stat_date = CURRENT_DATE
      AND ds.lp_change > 0
    ORDER BY ds.lp_change DESC
    LIMIT 50
  `);
  return { data: result.rows };
});

// ─────────────────────────────────────────
// 3. Günün en çok LP kaybedenleri
// ─────────────────────────────────────────
fastify.get('/api/leaderboard/losers', async (req, reply) => {
  const result = await db.query(`
    SELECT
      p.puuid,
      p.current_summoner_name || '#' || p.current_tagline AS display_name,
      p.tier, p.lp, p.is_in_game, p.profile_icon_id,
      ds.start_lp, ds.current_lp, ds.lp_change, ds.games_played
    FROM daily_stats ds
    JOIN players p ON p.puuid = ds.puuid
    WHERE ds.stat_date = CURRENT_DATE
      AND ds.lp_change < 0
    ORDER BY ds.lp_change ASC
    LIMIT 50
  `);
  return { data: result.rows };
});

// ─────────────────────────────────────────
// 4. Tek oyuncu profili
// ─────────────────────────────────────────
fastify.get('/api/player/:puuid', async (req, reply) => {
  const { puuid } = req.params;

  const player = await db.query(`SELECT * FROM players WHERE puuid=$1`, [puuid]);
  if (!player.rows[0]) return reply.code(404).send({ error: 'Oyuncu bulunamadı' });

  const nameHistory = await db.query(`
    SELECT old_name, old_tagline, new_name, new_tagline, changed_at
    FROM name_history WHERE puuid=$1 ORDER BY changed_at DESC
  `, [puuid]);

  const dailyStats = await db.query(`
    SELECT stat_date, start_lp, current_lp, lp_change, games_played, wins, losses, dodges
    FROM daily_stats WHERE puuid=$1 ORDER BY stat_date DESC LIMIT 30
  `, [puuid]);

  return {
    player: player.rows[0],
    nameHistory: nameHistory.rows,
    dailyStats: dailyStats.rows,
  };
});

// ─────────────────────────────────────────
// 5. Dodge listesi
// ─────────────────────────────────────────
fastify.get('/api/leaderboard/dodgers', async (req, reply) => {
  const result = await db.query(`
    SELECT
      p.current_summoner_name || '#' || p.current_tagline AS display_name,
      p.tier, p.profile_icon_id,
      COUNT(dl.id) AS dodge_count,
      SUM(dl.lp_lost) AS total_lp_lost
    FROM dodge_log dl
    JOIN players p ON p.puuid = dl.puuid
    WHERE DATE(dl.detected_at) = CURRENT_DATE
    GROUP BY p.puuid, display_name, p.tier, p.profile_icon_id
    ORDER BY dodge_count DESC LIMIT 20
  `);
  return { data: result.rows };
});

// ─────────────────────────────────────────
// 6. Cut-off LP bilgisi
// ─────────────────────────────────────────
fastify.get('/api/cutoff', async (req, reply) => {
  const result = await db.query(`
    SELECT
      MIN(CASE WHEN tier = 'CHALLENGER' THEN lp END) AS challenger_cutoff,
      MIN(CASE WHEN tier = 'GRANDMASTER' THEN lp END) AS gm_cutoff,
      COUNT(CASE WHEN tier = 'CHALLENGER' THEN 1 END) AS challenger_count,
      COUNT(CASE WHEN tier = 'GRANDMASTER' THEN 1 END) AS gm_count,
      COUNT(CASE WHEN tier = 'MASTER' THEN 1 END) AS master_count
    FROM players
    WHERE tier IN ('CHALLENGER', 'GRANDMASTER', 'MASTER')
  `);
  return { data: result.rows[0] };
});

// ─────────────────────────────────────────
// 7. Arama endpoint'i
// ─────────────────────────────────────────
fastify.get('/api/search', async (req, reply) => {
  const { q } = req.query;
  if (!q || q.length < 2) return { data: [] };

  const result = await db.query(`
    SELECT puuid, current_summoner_name, current_tagline, tier, rank, lp, profile_icon_id
    FROM players
    WHERE LOWER(current_summoner_name) LIKE LOWER($1)
      AND tier IN ('CHALLENGER','GRANDMASTER','MASTER')
    ORDER BY lp DESC
    LIMIT 10
  `, [`%${q}%`]);

  return { data: result.rows };
});

fastify.listen({ port: process.env.PORT || 3001, host: '0.0.0.0' });