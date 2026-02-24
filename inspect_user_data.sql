/*
  INSPECT USER DATA (RUN THIS TO SEE THE RAW TRUTH)
  
  This query shows you exactly what is in your Login Data (Auth) 
  vs. what is in your Public Profile (Table).
  
  If "metadata_avatar" has a link but "public_avatar" is NULL, 
  the sync didn't work.
*/

SELECT 
  au.email,
  au.raw_user_meta_data->>'username' as metadata_username,
  au.raw_user_meta_data->>'avatar_url' as metadata_avatar,
  pp.username as public_username,
  pp.avatar_url as public_avatar,
  pp.display_id
FROM auth.users au
LEFT JOIN public.profiles pp ON au.id = pp.id;
