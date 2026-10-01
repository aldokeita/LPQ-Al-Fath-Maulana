-- Repair initial imported memberships only when registration and both
-- creation timestamps independently agree on the earlier start date.
update public.class_memberships cm
set start_date = s.tanggal_pendaftaran
from public.santri s
where s.id = cm.santri_id
  and cm.status = 'active'
  and cm.end_date is null
  and cm.start_date > current_date
  and cm.class_id = s.current_class_id
  and s.tanggal_pendaftaran <= current_date
  and s.tanggal_pendaftaran = s.created_at::date
  and s.tanggal_pendaftaran = cm.created_at::date;

alter table public.class_memberships
  add constraint class_memberships_active_start_not_future
  check (status <> 'active' or start_date <= current_date);
