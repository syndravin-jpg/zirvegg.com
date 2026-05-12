-- players tablosu: her oyuncunun anlık durumu
CREATE TABLE players (
  puuid                 TEXT PRIMARY KEY,
  current_summoner_name TEXT NOT NULL,
  current_tagline       TEXT NOT NULL,
  region                TEXT NOT NULL DEFAULT 'TR1',
  tier                  TEXT,   -- CHALLENGER | GRANDMASTER | MASTER | DIAMOND
  rank                  TEXT,   -- I | II | III | IV
  lp                    INT     DEFAULT 0,
  wins                  INT     DEFAULT 0,
  losses                INT     DEFAULT 0,
  is_in_game            BOOLEAN DEFAULT FALSE,
  live_game_id          TEXT,
  last_checked_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- İsim geçmişi
CREATE TABLE name_history (
  id          BIGSERIAL PRIMARY KEY,
  puuid       TEXT NOT NULL REFERENCES players(puuid),
  old_name    TEXT NOT NULL,
  old_tagline TEXT NOT NULL,
  new_name    TEXT NOT NULL,
  new_tagline TEXT NOT NULL,
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_name_history_puuid ON name_history(puuid);

-- Günlük LP takip tablosu
CREATE TABLE daily_stats (
  id                BIGSERIAL PRIMARY KEY,
  puuid             TEXT NOT NULL REFERENCES players(puuid),
  stat_date         DATE NOT NULL,
  start_lp          INT  NOT NULL,  -- 00:00'da kaydedilen LP
  start_tier        TEXT NOT NULL,
  current_lp        INT,            -- güncellenir
  current_tier      TEXT,
  lp_change         INT GENERATED ALWAYS AS (current_lp - start_lp) STORED,
  games_played      INT  DEFAULT 0,
  wins              INT  DEFAULT 0,
  losses            INT  DEFAULT 0,
  dodges            INT  DEFAULT 0,
  UNIQUE (puuid, stat_date)
);
CREATE INDEX idx_daily_stats_date ON daily_stats(stat_date);

-- Yorumlar ve çok kriterli puanlama
CREATE TABLE comments_ratings (
  id                    BIGSERIAL PRIMARY KEY,
  target_puuid          TEXT NOT NULL REFERENCES players(puuid),
  author_user_id        TEXT NOT NULL,  -- site kullanıcısı ID
  comment_text          TEXT,
  image_url             TEXT,           -- S3 / Cloudflare R2 URL
  skill_rating          SMALLINT CHECK (skill_rating BETWEEN 1 AND 5),
  helpful_rating        SMALLINT CHECK (helpful_rating BETWEEN 1 AND 5),
  lane_knowledge_rating SMALLINT CHECK (lane_knowledge_rating BETWEEN 1 AND 5),
  shotcaller_rating     SMALLINT CHECK (shotcaller_rating BETWEEN 1 AND 5),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (target_puuid, author_user_id)  -- 1 kullanıcı 1 oy
);

-- LFG (Duo/Flex arama) ilanları
CREATE TABLE lfg_posts (
  id               BIGSERIAL PRIMARY KEY,
  user_id          TEXT NOT NULL,
  region           TEXT NOT NULL,
  role             TEXT NOT NULL,  -- TOP | JUNGLE | MID | ADC | SUPPORT | FILL
  looking_for_mode TEXT NOT NULL,  -- SOLOQ | FLEX | CLASH | ARAM
  min_rank         TEXT,
  max_rank         TEXT,
  description      TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  expires_at       TIMESTAMPTZ DEFAULT NOW() + INTERVAL '4 hours',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Dodge log
CREATE TABLE dodge_log (
  id           BIGSERIAL PRIMARY KEY,
  puuid        TEXT NOT NULL REFERENCES players(puuid),
  detected_at  TIMESTAMPTZ DEFAULT NOW(),
  lp_before    INT,
  lp_after     INT,
  lp_lost      INT GENERATED ALWAYS AS (lp_before - lp_after) STORED,
  detection_method TEXT  -- 'LP_DROP' | 'TIME_GAP'
);

-- Site kullanıcı profilleri (Discord ile bağlı)
CREATE TABLE user_profiles (
  id              TEXT PRIMARY KEY,  -- Discord user ID
  discord_username TEXT,
  claimed_puuid   TEXT REFERENCES players(puuid),  -- sahiplenilen LoL hesabı
  avatar_url      TEXT,
  background_url  TEXT,
  youtube_url     TEXT,
  tiktok_url      TEXT,
  instagram_url   TEXT,
  twitch_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);