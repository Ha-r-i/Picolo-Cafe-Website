-- Public bucket contains ONLY public menu images. No private reservation documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('menu-images','menu-images',true,3145728,array['image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No anon/authenticated write policy. Uploads go through staff-authorized API,
-- which decodes, resizes and re-encodes images before using the server secret.
create policy piccolo_public_menu_images on storage.objects for select to anon,authenticated using(bucket_id='menu-images');
