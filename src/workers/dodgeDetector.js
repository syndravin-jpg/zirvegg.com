import { db } from '../lib/db.js';

const DODGE_LP_THRESHOLDS = [3, 5, 10, 15];

export async function detectDodge(puuid, lpBefore, lpAfter) {
  const lpLost = lpBefore - lpAfter;

  if (!DODGE_LP_THRESHOLDS.includes(lpLost)) return;

  await db.query(`
    INSERT INTO dodge_log (puuid, lp_before, lp_after, detection_method)
    VALUES ($1, $2, $3, 'LP_DROP')
  `, [puuid, lpBefore, lpAfter]);

  await db.query(`
    UPDATE daily_stats SET dodges = dodges + 1
    WHERE puuid=$1 AND stat_date = CURRENT_DATE
  `, [puuid]);

  console.log(`[Dodge] ${puuid}: ${lpBefore} → ${lpAfter} LP (-${lpLost})`);
}