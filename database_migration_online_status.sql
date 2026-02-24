-- ============================================
-- ElCommunity: Online Status System Migration
-- ============================================
-- This script adds the 'last_seen' column to track user online status
-- Execute this in your Supabase SQL Editor

-- 1. Add last_seen and presence columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS presence TEXT DEFAULT 'offline';

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen);
CREATE INDEX IF NOT EXISTS idx_profiles_presence ON profiles(presence);

-- 3. Update existing users
UPDATE profiles SET last_seen = NOW(), presence = 'offline' WHERE last_seen IS NULL;

-- ============================================
-- Verification Query (Optional)
-- ============================================
-- Run this to verify the column was added successfully:
-- SELECT id, username, last_seen FROM profiles LIMIT 5;
