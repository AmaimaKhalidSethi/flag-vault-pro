
revoke execute on function public.current_team_id() from public, anon, authenticated;
revoke execute on function public.is_team_member(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
