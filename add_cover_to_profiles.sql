/*
  ADD COVER URL TO PROFILES
  
  This script adds a 'cover_url' column to the public.profiles table 
  to store the user's profile cover image URL.
*/

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'cover_url') THEN
        ALTER TABLE public.profiles ADD COLUMN cover_url TEXT;
    END IF;
END $$;
