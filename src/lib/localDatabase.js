// This file is deprecated. Supabase is now used for all data operations.
export const db = {
  select: () => ({ data: [], error: null }),
  selectOne: () => ({ data: null, error: null }),
  insert: () => ({ data: [], error: null }),
  update: () => ({ data: [], error: null }),
  delete: () => ({ error: null }),
  query: () => ({ data: [], error: null })
};