-- =====================================================================
-- El Taller de Gabo · Base de datos para el panel de administración
-- Ejecutar COMPLETO en Supabase > SQL Editor > New query > Run.
-- Se puede ejecutar varias veces sin errores (es idempotente) y
-- también actualiza un proyecto creado con la versión anterior.
-- NO pegues aquí contraseñas ni la clave service_role.
-- =====================================================================

-- 1. Administradores ----------------------------------------------------
create table if not exists public.administradores (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.administradores enable row level security;

-- Función auxiliar: ¿el usuario actual es administrador?
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.administradores where user_id = auth.uid());
$$;
revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;

drop policy if exists "admin puede consultar su propio acceso" on public.administradores;
create policy "admin puede consultar su propio acceso" on public.administradores
  for select to authenticated using (user_id = (select auth.uid()));

-- 2. Portafolio (referencias) ------------------------------------------
create table if not exists public.referencias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(titulo) between 1 and 100),
  categoria text not null,
  descripcion text not null default '',
  imagen_url text not null,
  created_at timestamptz not null default now()
);
alter table public.referencias add column if not exists storage_path text;
alter table public.referencias add column if not exists publicado boolean not null default true;
alter table public.referencias add column if not exists destacado boolean not null default false;
alter table public.referencias add column if not exists orden integer not null default 0;
alter table public.referencias enable row level security;

drop policy if exists "catalogo publico" on public.referencias;
drop policy if exists "admin inserta referencias" on public.referencias;
drop policy if exists "admin actualiza referencias" on public.referencias;
drop policy if exists "admin elimina referencias" on public.referencias;
create policy "catalogo publico" on public.referencias
  for select to anon, authenticated using (publicado or (select public.es_admin()));
create policy "admin inserta referencias" on public.referencias
  for insert to authenticated with check ((select public.es_admin()));
create policy "admin actualiza referencias" on public.referencias
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "admin elimina referencias" on public.referencias
  for delete to authenticated using ((select public.es_admin()));

-- 3. Solicitudes de cotización (llegan desde el formulario público) -----
create table if not exists public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(nombre) between 2 and 100),
  telefono text not null default '' check (length(telefono) <= 30),
  servicio text not null check (length(servicio) <= 60),
  medidas text not null default '' check (length(medidas) <= 500),
  ciudad text not null default '' check (length(ciudad) <= 100),
  detalles text not null default '' check (length(detalles) <= 1500),
  estado text not null default 'nueva' check (estado in ('nueva','contactada','cotizada','cerrada')),
  notas text not null default '' check (length(notas) <= 1500),
  created_at timestamptz not null default now()
);
alter table public.solicitudes enable row level security;

drop policy if exists "publico envia solicitudes" on public.solicitudes;
drop policy if exists "admin consulta solicitudes" on public.solicitudes;
drop policy if exists "admin actualiza solicitudes" on public.solicitudes;
drop policy if exists "admin elimina solicitudes" on public.solicitudes;
-- Cualquiera puede ENVIAR una solicitud nueva, pero nadie del público puede leerlas.
create policy "publico envia solicitudes" on public.solicitudes
  for insert to anon, authenticated with check (estado = 'nueva' and notas = '');
create policy "admin consulta solicitudes" on public.solicitudes
  for select to authenticated using ((select public.es_admin()));
create policy "admin actualiza solicitudes" on public.solicitudes
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "admin elimina solicitudes" on public.solicitudes
  for delete to authenticated using ((select public.es_admin()));

-- 4. Contenido editable del sitio (textos, WhatsApp, redes) -------------
create table if not exists public.ajustes (
  clave text primary key check (length(clave) <= 40),
  valor text not null default '' check (length(valor) <= 1000),
  updated_at timestamptz not null default now()
);
alter table public.ajustes enable row level security;

drop policy if exists "ajustes publicos" on public.ajustes;
drop policy if exists "admin escribe ajustes" on public.ajustes;
drop policy if exists "admin actualiza ajustes" on public.ajustes;
drop policy if exists "admin elimina ajustes" on public.ajustes;
create policy "ajustes publicos" on public.ajustes
  for select to anon, authenticated using (true);
create policy "admin escribe ajustes" on public.ajustes
  for insert to authenticated with check ((select public.es_admin()));
create policy "admin actualiza ajustes" on public.ajustes
  for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy "admin elimina ajustes" on public.ajustes
  for delete to authenticated using ((select public.es_admin()));

-- 5. Almacenamiento de fotos (bucket público "galeria") ------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('galeria', 'galeria', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "galeria lectura publica" on storage.objects;
drop policy if exists "galeria subida admin" on storage.objects;
drop policy if exists "galeria actualiza admin" on storage.objects;
drop policy if exists "galeria elimina admin" on storage.objects;
create policy "galeria lectura publica" on storage.objects
  for select to anon, authenticated using (bucket_id = 'galeria');
create policy "galeria subida admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'galeria' and (select public.es_admin()));
create policy "galeria actualiza admin" on storage.objects
  for update to authenticated using (bucket_id = 'galeria' and (select public.es_admin()));
create policy "galeria elimina admin" on storage.objects
  for delete to authenticated using (bucket_id = 'galeria' and (select public.es_admin()));

-- 6. Dar permiso de administradora --------------------------------------
-- Primero crea la cuenta en Authentication > Users > Add user
-- (marca "Auto Confirm User"). Luego esta línea la convierte en administradora.
-- Si usas otro correo, cámbialo aquí y vuelve a ejecutar solo esta línea.
insert into public.administradores (user_id)
select id from auth.users where email = 'eltallerdegabo01@gmail.com'
on conflict (user_id) do nothing;

-- Comprobación: debe devolver una fila con el correo de la administradora.
select u.email, a.user_id from public.administradores a join auth.users u on u.id = a.user_id;
