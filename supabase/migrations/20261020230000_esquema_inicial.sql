-- Esquema inicial: perfiles, equipos, dashboards y permisos, con RLS.

create extension if not exists "pgcrypto";

-- ---------- perfiles ----------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text not null,
  nombre text,
  rol_global text not null default 'usuario' check (rol_global in ('admin', 'usuario')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, correo, nombre, rol_global)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    -- El primer usuario registrado es administrador global.
    case when (select count(*) from public.perfiles) = 0 then 'admin' else 'usuario' end
  );
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------- equipos ----------
create table public.equipos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_por uuid not null references public.perfiles (id) on delete cascade,
  creado_en timestamptz not null default now()
);

create table public.miembros_equipo (
  equipo_id uuid not null references public.equipos (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  rol text not null default 'lector' check (rol in ('propietario', 'editor', 'lector')),
  creado_en timestamptz not null default now(),
  primary key (equipo_id, usuario_id)
);

-- Invitaciones por correo para usuarios que todavía no tienen cuenta.
create table public.invitaciones_equipo (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.equipos (id) on delete cascade,
  correo text not null,
  rol text not null default 'lector' check (rol in ('editor', 'lector')),
  creado_en timestamptz not null default now(),
  unique (equipo_id, correo)
);

-- ---------- dashboards ----------
create table public.dashboards (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  propietario_id uuid not null references public.perfiles (id) on delete cascade,
  equipo_id uuid references public.equipos (id) on delete set null,
  archivo_ruta text not null,
  archivo_nombre text not null,
  archivo_tamano bigint not null default 0,
  esquema jsonb not null default '{}'::jsonb,
  visibilidad text not null default 'privado' check (visibilidad in ('privado', 'equipo', 'publico')),
  publico_slug text unique,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.permisos_dashboard (
  dashboard_id uuid not null references public.dashboards (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  nivel text not null default 'lector' check (nivel in ('lector', 'editor')),
  creado_en timestamptz not null default now(),
  primary key (dashboard_id, usuario_id)
);

create index on public.dashboards (propietario_id);
create index on public.dashboards (equipo_id);
create index on public.miembros_equipo (usuario_id);

-- ---------- funciones auxiliares (security definer para evitar recursión en RLS) ----------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol_global = 'admin' and activo from public.perfiles where id = auth.uid()), false);
$$;

create or replace function public.rol_en_equipo(p_equipo uuid)
returns text language sql stable security definer set search_path = public as $$
  select rol from public.miembros_equipo where equipo_id = p_equipo and usuario_id = auth.uid();
$$;

create or replace function public.puede_ver_dashboard(d public.dashboards)
returns boolean language sql stable security definer set search_path = public as $$
  select d.visibilidad = 'publico'
      or d.propietario_id = auth.uid()
      or public.es_admin()
      or (d.equipo_id is not null and public.rol_en_equipo(d.equipo_id) is not null)
      or exists (select 1 from public.permisos_dashboard p where p.dashboard_id = d.id and p.usuario_id = auth.uid());
$$;

create or replace function public.puede_editar_dashboard(d public.dashboards)
returns boolean language sql stable security definer set search_path = public as $$
  select d.propietario_id = auth.uid()
      or public.es_admin()
      or (d.equipo_id is not null and public.rol_en_equipo(d.equipo_id) in ('propietario', 'editor'))
      or exists (select 1 from public.permisos_dashboard p where p.dashboard_id = d.id and p.usuario_id = auth.uid() and p.nivel = 'editor');
$$;

-- Al crear un equipo, el creador es propietario. Al registrarse, se aplican invitaciones pendientes.
create or replace function public.al_crear_equipo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.miembros_equipo (equipo_id, usuario_id, rol) values (new.id, new.creado_por, 'propietario');
  return new;
end $$;
create trigger equipo_creado after insert on public.equipos for each row execute function public.al_crear_equipo();

create or replace function public.aplicar_invitaciones()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.miembros_equipo (equipo_id, usuario_id, rol)
  select i.equipo_id, new.id, i.rol from public.invitaciones_equipo i where lower(i.correo) = lower(new.correo)
  on conflict do nothing;
  delete from public.invitaciones_equipo where lower(correo) = lower(new.correo);
  return new;
end $$;
create trigger perfil_creado after insert on public.perfiles for each row execute function public.aplicar_invitaciones();

create or replace function public.tocar_actualizado()
returns trigger language plpgsql as $$
begin new.actualizado_en = now(); return new; end $$;
create trigger dashboard_actualizado before update on public.dashboards for each row execute function public.tocar_actualizado();

-- ---------- RLS ----------
alter table public.perfiles enable row level security;
alter table public.equipos enable row level security;
alter table public.miembros_equipo enable row level security;
alter table public.invitaciones_equipo enable row level security;
alter table public.dashboards enable row level security;
alter table public.permisos_dashboard enable row level security;

-- perfiles: cada uno ve el suyo; los miembros de un mismo equipo se ven entre sí; admin ve todos.
create policy perfiles_ver on public.perfiles for select using (
  id = auth.uid() or public.es_admin()
  or exists (select 1 from public.miembros_equipo a join public.miembros_equipo b on a.equipo_id = b.equipo_id
             where a.usuario_id = auth.uid() and b.usuario_id = perfiles.id)
);
create policy perfiles_editar_propio on public.perfiles for update using (id = auth.uid() or public.es_admin())
  with check (
    -- Solo un admin puede cambiar rol_global o activo.
    public.es_admin() or (rol_global = (select rol_global from public.perfiles p where p.id = auth.uid())
                          and activo = (select activo from public.perfiles p where p.id = auth.uid()))
  );

-- equipos
create policy equipos_ver on public.equipos for select using (public.rol_en_equipo(id) is not null or public.es_admin());
create policy equipos_crear on public.equipos for insert with check (creado_por = auth.uid());
create policy equipos_editar on public.equipos for update using (public.rol_en_equipo(id) = 'propietario' or public.es_admin());
create policy equipos_borrar on public.equipos for delete using (public.rol_en_equipo(id) = 'propietario' or public.es_admin());

-- miembros
create policy miembros_ver on public.miembros_equipo for select using (public.rol_en_equipo(equipo_id) is not null or public.es_admin());
create policy miembros_gestionar on public.miembros_equipo for all
  using (public.rol_en_equipo(equipo_id) = 'propietario' or public.es_admin())
  with check (public.rol_en_equipo(equipo_id) = 'propietario' or public.es_admin());
create policy miembros_salir on public.miembros_equipo for delete using (usuario_id = auth.uid());

-- invitaciones
create policy invitaciones_gestionar on public.invitaciones_equipo for all
  using (public.rol_en_equipo(equipo_id) in ('propietario', 'editor') or public.es_admin())
  with check (public.rol_en_equipo(equipo_id) in ('propietario', 'editor') or public.es_admin());

-- dashboards
create policy dashboards_ver on public.dashboards for select using (public.puede_ver_dashboard(dashboards));
create policy dashboards_crear on public.dashboards for insert with check (
  propietario_id = auth.uid() and (equipo_id is null or public.rol_en_equipo(equipo_id) in ('propietario', 'editor'))
);
create policy dashboards_editar on public.dashboards for update using (public.puede_editar_dashboard(dashboards));
create policy dashboards_borrar on public.dashboards for delete using (propietario_id = auth.uid() or public.es_admin());

-- permisos explícitos: los gestiona el propietario; el beneficiario puede ver el suyo.
create policy permisos_ver on public.permisos_dashboard for select using (
  usuario_id = auth.uid() or public.es_admin()
  or exists (select 1 from public.dashboards d where d.id = dashboard_id and d.propietario_id = auth.uid())
);
create policy permisos_gestionar on public.permisos_dashboard for all
  using (public.es_admin() or exists (select 1 from public.dashboards d where d.id = dashboard_id and d.propietario_id = auth.uid()))
  with check (public.es_admin() or exists (select 1 from public.dashboards d where d.id = dashboard_id and d.propietario_id = auth.uid()));

-- ---------- Storage: bucket privado para los archivos ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('archivos', 'archivos', false, 52428800)
on conflict (id) do nothing;

-- Ruta de objeto: <dashboard_id>/<nombre>. Acceso según el dashboard.
create policy archivos_leer on storage.objects for select using (
  bucket_id = 'archivos' and exists (
    select 1 from public.dashboards d where d.id::text = split_part(name, '/', 1) and public.puede_ver_dashboard(d)
  )
);
create policy archivos_escribir on storage.objects for insert with check (
  bucket_id = 'archivos' and exists (
    select 1 from public.dashboards d where d.id::text = split_part(name, '/', 1) and public.puede_editar_dashboard(d)
  )
);
create policy archivos_actualizar on storage.objects for update using (
  bucket_id = 'archivos' and exists (
    select 1 from public.dashboards d where d.id::text = split_part(name, '/', 1) and public.puede_editar_dashboard(d)
  )
);
create policy archivos_borrar on storage.objects for delete using (
  bucket_id = 'archivos' and exists (
    select 1 from public.dashboards d where d.id::text = split_part(name, '/', 1) and (d.propietario_id = auth.uid() or public.es_admin())
  )
);

-- Búsqueda de usuarios por correo exacto para compartir (no expone la lista completa).
create or replace function public.buscar_usuario(p_correo text)
returns table (id uuid, correo text, nombre text)
language sql stable security definer set search_path = public as $$
  select id, correo, nombre from public.perfiles where lower(correo) = lower(p_correo) and activo limit 1;
$$;
