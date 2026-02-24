-- 1. Add email column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Create a specific function to sync emails (Security Definer allows reading auth.users)
CREATE OR REPLACE FUNCTION public.sync_emails_to_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update existing profiles with email from auth.users
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id
  AND p.email IS DISTINCT FROM u.email;
END;
$$;

-- 3. Run the sync immediately
SELECT public.sync_emails_to_profiles();

-- 4. Create a trigger to keep emails synced on new user creation
-- First, the function that the trigger calls
CREATE OR REPLACE FUNCTION public.handle_new_user_email_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update the profile with the email
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO UPDATE
  SET email = new.email;
  RETURN new;
END;
$$;

-- Then, the trigger itself on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_email_sync ON auth.users;
CREATE TRIGGER on_auth_user_created_email_sync
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_email_sync();

-- 5. Ensure Super Admins can READ the email column
-- (RLS policies already fixed in previous step, so simple SELECT is enough)
