-- Logical migration: remove the legacy numeric points overload.
-- The old overload used class-scoped authorization and could make PostgREST
-- choose ambiguously between numeric and integer RPC signatures. The integer
-- RPC from 20260820000100 is the single supported points contract.

drop function if exists public.increment_santri_points(uuid, numeric);
