-- Read-only checks after applying the face attendance pilot migrations
-- (20261007000100_face_attendance_pilot.sql, 20261014000100_face_attendance_passive_kiosk.sql,
-- 20261015000100_face_attendance_guru.sql, 20261015000200_face_attendance_guru_admin.sql,
-- 20261015000300_face_attendance_default_calibration.sql).
-- Run as postgres (SQL Editor or psql). Every column must be true.
select
  (select count(*) from supabase_migrations.schema_migrations
    where version in ('20261007000100', '20261014000100', '20261015000100', '20261015000200', '20261015000300')) = 5 as migrations_recorded,
  to_regnamespace('biometric_private') is not null as schema_exists,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'biometric_private' and c.relkind = 'r' and c.relrowsecurity) = 7 as rls_on_all_tables,
  not has_schema_privilege('anon', 'biometric_private', 'usage')
    and not has_schema_privilege('authenticated', 'biometric_private', 'usage') as schema_not_exposed,
  not exists (select 1 from information_schema.role_table_grants
    where table_schema = 'biometric_private' and grantee in ('anon', 'authenticated', 'PUBLIC')) as tables_not_exposed,
  not has_function_privilege('anon', 'public.pilot_face_operation(uuid,text,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.pilot_face_operation(uuid,text,jsonb)', 'execute')
    and has_function_privilege('service_role', 'public.pilot_face_operation(uuid,text,jsonb)', 'execute') as face_rpc_service_role_only,
  not has_function_privilege('anon', 'public.pilot_record_santri_attendance(uuid,uuid,uuid,text,timestamptz,text,text,text,numeric)', 'execute')
    and not has_function_privilege('authenticated', 'public.pilot_record_santri_attendance(uuid,uuid,uuid,text,timestamptz,text,text,text,numeric)', 'execute')
    and has_function_privilege('service_role', 'public.pilot_record_santri_attendance(uuid,uuid,uuid,text,timestamptz,text,text,text,numeric)', 'execute') as record_rpc_service_role_only,
  -- The passive kiosk migration raised the challenge limit from 12 to 40 per minute.
  pg_get_functiondef('public.pilot_face_operation(uuid,text,jsonb)'::regprocedure) like '%>=40%' as passive_kiosk_version,
  -- The guru migration adds self-enrolment and guru matching to the same RPC.
  pg_get_functiondef('public.pilot_face_operation(uuid,text,jsonb)'::regprocedure) like '%guru_matched%' as guru_face_version,
  -- The admin migration lets admins register a guru's face from Manajemen Guru.
  pg_get_functiondef('public.pilot_face_operation(uuid,text,jsonb)'::regprocedure) like '%guru_enroll%' as guru_admin_version,
  -- Matching falls back to built-in calibration defaults instead of refusing.
  pg_get_functiondef('public.pilot_face_operation(uuid,text,jsonb)'::regprocedure) like '%defaultCalibration%' as default_calibration_version,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'attendance_source_check' and conrelid = 'public.attendance'::regclass)
    ~ '''face''' as source_allows_face,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'attendance_source_check' and conrelid = 'public.attendance'::regclass)
    ~ '''rfid''.*''manual''.*''correction''.*''import''' as source_keeps_existing_values,
  (select count(*) from biometric_private.guru_enrollments) = 0 as guru_face_data_empty;
