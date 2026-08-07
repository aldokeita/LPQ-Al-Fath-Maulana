-- Update the active attendance session times to the agreed schedule.
--
-- Every session start moves forward 15 minutes (Pagi 08:00, not 07:45) and
-- the on-time deadline is 1 minute after start, so any arrival more than one
-- minute past the start time counts as Terlambat.
--
-- "open" and "end" are unchanged from the previous configuration (Sore opens
-- at 14:45, matching what is already stored). This keeps validation
-- open <= start <= onTimeUntil <= end satisfied for every session.

update public.website_content
set content = '{
  "version": 1,
  "enforceSessionEnd": true,
  "sessions": {
    "Pagi":    { "open": "06:00", "start": "08:00", "onTimeUntil": "08:01", "end": "09:15", "defaultQuota": 60 },
    "Pagi 2":  { "open": "09:15", "start": "10:15", "onTimeUntil": "10:16", "end": "11:30", "defaultQuota": 60 },
    "Siang":   { "open": "12:00", "start": "14:00", "onTimeUntil": "14:01", "end": "15:15", "defaultQuota": 80 },
    "Sore":    { "open": "14:45", "start": "16:00", "onTimeUntil": "16:01", "end": "17:15", "defaultQuota": 80 },
    "Malam":   { "open": "17:45", "start": "18:45", "onTimeUntil": "18:46", "end": "23:00", "defaultQuota": 50 }
  }
}'::jsonb
where key = 'attendance_session_config';
