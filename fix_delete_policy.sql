-- Allow authors to delete their own guides
-- Currently, RLS is enabled but no DELETE policy exists, blocking deletion.
create policy "Authors can delete their own guides"
on public.guides for delete
using ( auth.uid() = author_id );
