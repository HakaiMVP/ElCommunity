-- 0. Clean up existing tables and policies (FORCE RESET)
DROP TABLE IF EXISTS daily_rewards_claims CASCADE;
DROP TABLE IF EXISTS daily_rewards_config CASCADE;

-- 1. Reward Configuration Table (admin sets rewards per day, up to 90 days)
CREATE TABLE daily_rewards_config (
    id SERIAL PRIMARY KEY,
    day_number INT NOT NULL CHECK (day_number >= 1 AND day_number <= 90), -- Day 1 to 90
    reward_type TEXT NOT NULL CHECK (reward_type IN ('stars', 'item')),
    reward_value TEXT NOT NULL,
    reward_label TEXT NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(day_number)
);

-- 2. User Claims Tracking Table
CREATE TABLE IF NOT EXISTS daily_rewards_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    claim_date DATE NOT NULL,
    day_number INT NOT NULL,
    reward_type TEXT NOT NULL,
    reward_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, claim_date)
);

-- 3. Enable RLS
ALTER TABLE daily_rewards_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_rewards_claims ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for daily_rewards_config
-- Everyone can read config
DROP POLICY IF EXISTS "Anyone can read reward config" ON daily_rewards_config;
CREATE POLICY "Anyone can read reward config" ON daily_rewards_config
    FOR SELECT USING (true);

-- Only admins can modify (we check via profiles.global_role)
DROP POLICY IF EXISTS "Admins can insert reward config" ON daily_rewards_config;
CREATE POLICY "Admins can insert reward config" ON daily_rewards_config
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND global_role IN ('admin', 'super_admin'))
    );

DROP POLICY IF EXISTS "Admins can update reward config" ON daily_rewards_config;
CREATE POLICY "Admins can update reward config" ON daily_rewards_config
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND global_role IN ('admin', 'super_admin'))
    );

DROP POLICY IF EXISTS "Admins can delete reward config" ON daily_rewards_config;
CREATE POLICY "Admins can delete reward config" ON daily_rewards_config
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND global_role IN ('admin', 'super_admin'))
    );

-- 5. RLS Policies for daily_rewards_claims
-- Users can read their own claims
DROP POLICY IF EXISTS "Users can read own claims" ON daily_rewards_claims;
CREATE POLICY "Users can read own claims" ON daily_rewards_claims
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own claims
DROP POLICY IF EXISTS "Users can insert own claims" ON daily_rewards_claims;
CREATE POLICY "Users can insert own claims" ON daily_rewards_claims
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Seed default rewards (escalating stars over 90 days)
INSERT INTO daily_rewards_config (day_number, reward_type, reward_value, reward_label)
SELECT
    d,
    'stars',
    CAST(
        CASE
            WHEN d <= 7 THEN 100 + (d * 50)
            WHEN d <= 30 THEN 300 + ((d - 7) * 20)
            WHEN d <= 60 THEN 800 + ((d - 30) * 15)
            ELSE 1200 + ((d - 60) * 20)
        END AS TEXT
    ),
    CAST(
        CASE
            WHEN d <= 7 THEN 100 + (d * 50)
            WHEN d <= 30 THEN 300 + ((d - 7) * 20)
            WHEN d <= 60 THEN 800 + ((d - 30) * 15)
            ELSE 1200 + ((d - 60) * 20)
        END AS TEXT
    ) || ' Estrelas'
FROM generate_series(1, 90) AS d
ON CONFLICT (day_number) DO NOTHING;
