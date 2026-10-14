-- Face attendance pilot removal (forward-fix). NOT applied automatically: it lives outside
-- supabase/migrations on purpose.
--
-- Use only if the pilot must be taken out of a database that already ran
-- 20261007000100_face_attendance_pilot.sql, 20261014000100_face_attendance_passive_kiosk.sql
-- 20261015000100_face_attendance_guru.sql and 20261015000200_face_attendance_guru_admin.sql:
--   1. Take a backup first.
--   2. Copy this file to supabase/migrations/<new timestamp>_remove_face_attendance_pilot.sql,
--      commit it, and apply it with `supabase db push` so migration history stays truthful.
--   3. Remove FACE_ATTENDANCE_PILOT from the function secrets and VITE_FACE_ATTENDANCE_PILOT from the frontend.
--
-- Effect: deletes all santri and guru face templates, consent records, challenges, calibration and receipts, drops the
-- pilot RPCs, and restores attendance.source to its pre-pilot values. Attendance rows, points and
-- profile photos are kept. The vector extension is left installed (harmless, may be shared).

-- Attendance recorded by face (santri and guru) would violate the restored check; relabel it so history is kept and
-- the origin stays traceable through correction_reason.
update public.attendance
set source = 'manual',
    correction_reason = coalesce(nullif(btrim(correction_reason), '') || ' | ', '') || 'Dicatat lewat pilot absensi wajah (dihapus)'
where source = 'face';

drop function if exists public.pilot_record_santri_attendance(uuid, uuid, uuid, text, timestamptz, text, text, text, numeric);
drop function if exists public.pilot_face_operation(uuid, text, jsonb);
drop schema if exists biometric_private cascade;

alter table public.attendance drop constraint if exists attendance_source_check;
alter table public.attendance add constraint attendance_source_check
  check (source in ('rfid', 'manual', 'correction', 'import'));
