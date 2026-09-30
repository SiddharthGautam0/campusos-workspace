
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.on_join_request() from public, anon, authenticated;
revoke execute on function public.on_new_post() from public, anon, authenticated;
revoke execute on function public.audit() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, app_role) from public, anon;
revoke execute on function public.is_class_teacher(uuid, uuid) from public, anon;
revoke execute on function public.can_access_class(uuid, uuid) from public, anon;
revoke execute on function public.shares_class(uuid, uuid) from public, anon;
grant execute on function public.has_role(uuid, app_role) to authenticated;
grant execute on function public.is_class_teacher(uuid, uuid) to authenticated;
grant execute on function public.can_access_class(uuid, uuid) to authenticated;
grant execute on function public.shares_class(uuid, uuid) to authenticated;
