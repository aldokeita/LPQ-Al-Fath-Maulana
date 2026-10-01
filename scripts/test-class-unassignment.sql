-- Run with supabase db query --linked --file scripts/test-class-unassignment.sql.
-- All fixture changes roll back before the result is returned.
create temporary table class_unassignment_probe (
  passed boolean, error_code text, message text, fixture_rolled_back boolean
) on commit drop;
do $probe$
declare
  v_student uuid := gen_random_uuid();
  v_admin uuid;
  v_class uuid;
  v_session text;
  v_result record;
  v_passed boolean := false;
  v_code text;
  v_message text;
begin
  begin
    select id into strict v_admin from public.user_profiles
    where role = 'admin' and status = 'active' order by created_at limit 1;
    select id, sesi into strict v_class, v_session from public.classes
    where is_active and deleted_at is null order by created_at limit 1;
    insert into auth.users (id, email) values (v_student, 'fixture-' || v_student || '@invalid.example');
    insert into public.santri (id, nomor_induk_qiroati, nama_lengkap, kategori,
      status, current_class_id, sesi_mengaji, order_in_class)
    values (v_student, 'AFMTEST-' || v_student, 'Santri Fixture Unassignment', 'Anak',
      'Aktif', v_class, v_session, 1);
    insert into public.class_memberships (santri_id, class_id, start_date, status, order_in_class)
    values (v_student, v_class, current_date, 'active', 1);
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

    select * into v_result from public.remove_santri_from_class(v_student, 'Fixture removal');
    if not v_result.changed or v_result.active_memberships <> 0 or v_result.to_class_id is not null
      or v_result.from_class_id <> v_class or v_result.mutation_id is null then
      raise exception 'Removal result is incorrect';
    end if;
    if not exists (select 1 from public.santri where id = v_student and current_class_id is null
      and order_in_class is null and status = 'Aktif' and sesi_mengaji is not distinct from v_session) then
      raise exception 'Unassigned santri profile is incorrect';
    end if;
    if not exists (select 1 from public.class_memberships where santri_id = v_student
      and status = 'inactive' and end_date = current_date and class_id = v_class) then
      raise exception 'Previous membership was not preserved';
    end if;
    if not exists (select 1 from public.class_mutations where santri_id = v_student
      and from_class_id = v_class and to_class_id is null and created_by = v_admin) then
      raise exception 'Removal history is missing';
    end if;

    select * into v_result from public.remove_santri_from_class(v_student, 'Fixture retry');
    if v_result.changed or (select count(*) from public.class_mutations where santri_id = v_student) <> 1 then
      raise exception 'Repeated removal duplicated history';
    end if;

    perform set_config('request.jwt.claims', json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
    begin
      perform public.remove_santri_from_class(v_student, 'Unauthorized fixture');
      raise exception 'Removal without an application profile was accepted';
    exception when insufficient_privilege then null;
    end;
    insert into public.user_profiles (id, role, status) values (v_student, 'guru', 'active');
    begin
      perform public.remove_santri_from_class(v_student, 'Guru fixture');
      raise exception 'Guru removal was accepted';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claims', '{}', true);
    begin
      perform public.remove_santri_from_class(v_student, 'Unauthenticated fixture');
      raise exception 'Unauthenticated removal was accepted';
    exception when sqlstate '28000' then null;
    end;

    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    select * into v_result from public.move_santri_to_class(v_student, v_class, 'Fixture reenrollment');
    if not v_result.changed or v_result.active_memberships <> 1 then
      raise exception 'Reenrollment failed';
    end if;
    if has_function_privilege('anon', 'public.remove_santri_from_class(uuid,text)', 'EXECUTE') then
      raise exception 'Anonymous RPC access was granted';
    end if;
    v_passed := true;
    raise sqlstate 'ZX001' using message = 'Rollback fixture';
  exception
    when sqlstate 'ZX001' then null;
    when others then get stacked diagnostics v_code = returned_sqlstate, v_message = message_text;
  end;
  insert into class_unassignment_probe values (v_passed, v_code, v_message,
    not exists (select 1 from auth.users where id = v_student));
end;
$probe$;
select * from class_unassignment_probe;
