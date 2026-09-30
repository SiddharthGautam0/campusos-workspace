
create policy "class files read" on storage.objects for select to authenticated
  using (bucket_id='class-files' and public.can_access_class(((storage.foldername(name))[1])::uuid, auth.uid()));
create policy "class files admin upload" on storage.objects for insert to authenticated
  with check (bucket_id='class-files' and public.has_role(auth.uid(),'admin'));
create policy "class files admin delete" on storage.objects for delete to authenticated
  using (bucket_id='class-files' and public.has_role(auth.uid(),'admin'));
