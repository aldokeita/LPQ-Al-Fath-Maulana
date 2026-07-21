# Auth and Seed Safety Skeleton

Checks planned for Phase 3B-2:

- Auth dummy users exist before `supabase/seed.sql` is run.
- Seed contains only Demo/Dummy identities.
- Seed is never executed against production.
- Passwords and tokens are not written to logs.
