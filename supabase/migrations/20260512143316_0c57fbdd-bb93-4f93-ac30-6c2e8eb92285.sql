
REVOKE EXECUTE ON FUNCTION public.remove_team_member(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.join_team_by_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_team_by_code(text) TO authenticated;
