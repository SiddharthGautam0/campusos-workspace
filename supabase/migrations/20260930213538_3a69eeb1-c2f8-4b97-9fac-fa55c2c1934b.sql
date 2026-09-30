
create type public.app_role as enum ('student','teacher','admin');
create type public.post_type as enum ('announcement','assignment','resource','link');
create type public.request_status as enum ('pending','approved','rejected');

-- profiles
create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

-- hierarchy
create table public.courses (id uuid primary key default gen_random_uuid(), name text not null, code text not null unique, created_at timestamptz not null default now());
create table public.years (id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade, label text not null, position int not null default 1, unique(course_id,label));
create table public.sections (id uuid primary key default gen_random_uuid(), year_id uuid not null references public.years(id) on delete cascade, name text not null, unique(year_id,name));
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  name text not null,
  code text not null,
  description text not null default '',
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.years(course_id);
create index on public.sections(year_id);
create index on public.classes(section_id);
create index on public.classes(teacher_id);
grant select on public.courses, public.years, public.sections, public.classes to authenticated;
grant insert, update, delete on public.courses, public.years, public.sections, public.classes to authenticated;
grant all on public.courses, public.years, public.sections, public.classes to service_role;
alter table public.courses enable row level security;
alter table public.years enable row level security;
alter table public.sections enable row level security;
alter table public.classes enable row level security;

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id,user_id)
);
create index on public.class_members(user_id);
grant select, delete on public.class_members to authenticated;
grant all on public.class_members to service_role;
alter table public.class_members enable row level security;

create or replace function public.is_class_teacher(_class uuid, _user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.classes where id=_class and teacher_id=_user)
$$;
create or replace function public.can_access_class(_class uuid, _user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_role(_user,'admin')
    or public.is_class_teacher(_class,_user)
    or exists(select 1 from public.class_members where class_id=_class and user_id=_user)
$$;
create or replace function public.shares_class(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.classes c
    where (c.teacher_id=_a or exists(select 1 from public.class_members m where m.class_id=c.id and m.user_id=_a))
      and (c.teacher_id=_b or exists(select 1 from public.class_members m where m.class_id=c.id and m.user_id=_b))
  )
$$;

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '',
  status request_status not null default 'pending',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index join_requests_one_pending on public.join_requests(class_id,student_id) where status='pending';
create index on public.join_requests(student_id);
create index on public.join_requests(class_id,status);
grant select, insert, update, delete on public.join_requests to authenticated;
grant all on public.join_requests to service_role;
alter table public.join_requests enable row level security;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  type post_type not null default 'announcement',
  title text not null,
  body text not null default '',
  url text,
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.posts(class_id, created_at desc);
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;

create table public.units (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text not null default '',
  position int not null default 1,
  created_at timestamptz not null default now()
);
create index on public.units(class_id);
create table public.unit_items (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','link')),
  title text not null,
  body text not null default '',
  url text,
  created_at timestamptz not null default now()
);
create index on public.unit_items(unit_id);
grant select, insert, update, delete on public.units, public.unit_items to authenticated;
grant all on public.units, public.unit_items to service_role;
alter table public.units enable row level security;
alter table public.unit_items enable row level security;

create table public.files (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  name text not null,
  storage_path text not null unique,
  size_bytes bigint not null default 0,
  mime_type text,
  created_at timestamptz not null default now()
);
create index on public.files(class_id);
grant select, insert, delete on public.files to authenticated;
grant all on public.files to service_role;
alter table public.files enable row level security;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, created_at desc);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs(created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

-- ===== POLICIES =====
create policy "profiles self/shared/admin read" on public.profiles for select to authenticated
  using (id=auth.uid() or public.has_role(auth.uid(),'admin') or public.shares_class(auth.uid(),id)
    or exists(select 1 from public.join_requests r join public.classes c on c.id=r.class_id where r.student_id=profiles.id and c.teacher_id=auth.uid())
    or exists(select 1 from public.user_roles ur where ur.user_id=profiles.id and ur.role='teacher'));
create policy "profiles self update" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

create policy "roles own or admin read" on public.user_roles for select to authenticated
  using (user_id=auth.uid() or public.has_role(auth.uid(),'admin') or role='teacher');

-- hierarchy: everyone signed in can browse (discover); only admin writes
create policy "read courses" on public.courses for select to authenticated using (true);
create policy "admin courses" on public.courses for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "read years" on public.years for select to authenticated using (true);
create policy "admin years" on public.years for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "read sections" on public.sections for select to authenticated using (true);
create policy "admin sections" on public.sections for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "read classes" on public.classes for select to authenticated using (true);
create policy "admin classes" on public.classes for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "members read" on public.class_members for select to authenticated using (public.can_access_class(class_id,auth.uid()));
create policy "teacher/admin remove member" on public.class_members for delete to authenticated
  using (public.is_class_teacher(class_id,auth.uid()) or public.has_role(auth.uid(),'admin') or user_id=auth.uid());

create policy "requests read" on public.join_requests for select to authenticated
  using (student_id=auth.uid() or public.is_class_teacher(class_id,auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "student creates request" on public.join_requests for insert to authenticated
  with check (student_id=auth.uid() and status='pending' and public.has_role(auth.uid(),'student')
    and not exists(select 1 from public.class_members m where m.class_id=join_requests.class_id and m.user_id=auth.uid()));
create policy "teacher decides" on public.join_requests for update to authenticated
  using (public.is_class_teacher(class_id,auth.uid()) or public.has_role(auth.uid(),'admin'))
  with check (public.is_class_teacher(class_id,auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "student cancels pending" on public.join_requests for delete to authenticated
  using (student_id=auth.uid() and status='pending');

create policy "posts read" on public.posts for select to authenticated using (public.can_access_class(class_id,auth.uid()));
create policy "posts write" on public.posts for insert to authenticated
  with check (author_id=auth.uid() and (public.is_class_teacher(class_id,auth.uid()) or public.has_role(auth.uid(),'admin')));
create policy "posts update" on public.posts for update to authenticated
  using (public.is_class_teacher(class_id,auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "posts delete" on public.posts for delete to authenticated
  using (public.is_class_teacher(class_id,auth.uid()) or public.has_role(auth.uid(),'admin'));

create policy "units read" on public.units for select to authenticated using (public.can_access_class(class_id,auth.uid()));
create policy "units manage" on public.units for all to authenticated
  using (public.is_class_teacher(class_id,auth.uid()) or public.has_role(auth.uid(),'admin'))
  with check (public.is_class_teacher(class_id,auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "items read" on public.unit_items for select to authenticated
  using (exists(select 1 from public.units u where u.id=unit_id and public.can_access_class(u.class_id,auth.uid())));
create policy "items manage" on public.unit_items for all to authenticated
  using (exists(select 1 from public.units u where u.id=unit_id and (public.is_class_teacher(u.class_id,auth.uid()) or public.has_role(auth.uid(),'admin'))))
  with check (exists(select 1 from public.units u where u.id=unit_id and (public.is_class_teacher(u.class_id,auth.uid()) or public.has_role(auth.uid(),'admin'))));

create policy "files read" on public.files for select to authenticated using (public.can_access_class(class_id,auth.uid()));
create policy "files admin insert" on public.files for insert to authenticated with check (public.has_role(auth.uid(),'admin') and uploaded_by=auth.uid());
create policy "files admin delete" on public.files for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "own notifications" on public.notifications for select to authenticated using (user_id=auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "own notifications delete" on public.notifications for delete to authenticated using (user_id=auth.uid());

create policy "admin audit read" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ===== TRIGGERS =====
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email);
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id,'admin');
  else
    insert into public.user_roles(user_id, role) values (new.id,'student');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.on_join_request() returns trigger language plpgsql security definer set search_path=public as $$
declare c record;
begin
  select cl.*, p.full_name as student_name into c from public.classes cl, public.profiles p where cl.id=new.class_id and p.id=new.student_id;
  if tg_op='INSERT' then
    if c.teacher_id is not null then
      insert into public.notifications(user_id,title,body,link) values (c.teacher_id,'New join request', c.student_name||' wants to join '||c.name, '/requests');
    end if;
  elsif tg_op='UPDATE' and new.status<>old.status then
    if old.status<>'pending' then raise exception 'Request already decided'; end if;
    new.decided_by := auth.uid(); new.decided_at := now();
    if new.status='approved' then
      insert into public.class_members(class_id,user_id) values (new.class_id,new.student_id) on conflict do nothing;
      insert into public.notifications(user_id,title,body,link) values (new.student_id,'Request approved','You now have access to '||c.name,'/classes/'||new.class_id);
    elsif new.status='rejected' then
      insert into public.notifications(user_id,title,body,link) values (new.student_id,'Request declined','Your request to join '||c.name||' was declined','/discover');
    end if;
  end if;
  return new;
end $$;
create trigger join_request_insert after insert on public.join_requests for each row execute function public.on_join_request();
create trigger join_request_update before update on public.join_requests for each row execute function public.on_join_request();

create or replace function public.on_new_post() returns trigger language plpgsql security definer set search_path=public as $$
declare cname text;
begin
  select name into cname from public.classes where id=new.class_id;
  insert into public.notifications(user_id,title,body,link)
    select m.user_id, 'New '||new.type||' in '||cname, new.title, '/classes/'||new.class_id
    from public.class_members m where m.class_id=new.class_id and m.user_id<>new.author_id;
  return new;
end $$;
create trigger post_notify after insert on public.posts for each row execute function public.on_new_post();

create or replace function public.audit() returns trigger language plpgsql security definer set search_path=public as $$
declare rec jsonb;
begin
  rec := to_jsonb(coalesce(new, old));
  insert into public.audit_logs(actor_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, rec->>'id', rec);
  return coalesce(new, old);
end $$;
create trigger audit_courses after insert or update or delete on public.courses for each row execute function public.audit();
create trigger audit_years after insert or update or delete on public.years for each row execute function public.audit();
create trigger audit_sections after insert or update or delete on public.sections for each row execute function public.audit();
create trigger audit_classes after insert or update or delete on public.classes for each row execute function public.audit();
create trigger audit_files after insert or delete on public.files for each row execute function public.audit();
create trigger audit_roles after insert or delete on public.user_roles for each row execute function public.audit();

-- admin role management via RPC
create or replace function public.set_user_role(_user uuid, _role app_role) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  if _user = auth.uid() then raise exception 'Cannot change your own role'; end if;
  delete from public.user_roles where user_id=_user;
  insert into public.user_roles(user_id, role) values (_user, _role);
end $$;
revoke execute on function public.set_user_role(uuid, app_role) from public, anon;
grant execute on function public.set_user_role(uuid, app_role) to authenticated;

alter publication supabase_realtime add table public.notifications;

-- seed hierarchy
insert into public.courses(id,name,code) values ('11111111-0000-0000-0000-000000000001','Bachelor of Computer Applications','BCA');
insert into public.years(id,course_id,label,position) values ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','1st Year',1);
insert into public.sections(id,year_id,name) values ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','Section A');
insert into public.classes(section_id,name,code,description) values
('33333333-0000-0000-0000-000000000001','Computer Fundamentals','BCA101','Hardware, software, number systems and the basics of computing.'),
('33333333-0000-0000-0000-000000000001','Mathematics','BCA102','Discrete mathematics, sets, relations and logic.'),
('33333333-0000-0000-0000-000000000001','Business Communication','BCA103','Professional writing, presentation and communication.'),
('33333333-0000-0000-0000-000000000001','Soft Skills','BCA104','Teamwork, time management and interpersonal skills.');
