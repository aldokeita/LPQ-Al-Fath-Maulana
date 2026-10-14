// Minimal chainable stand-in for supabase-js. Each awaited query is passed to `fake.respond`,
// which returns { data, error, count }; every query is also kept in `fake.queries` for assertions.
export const fake = { queries: [], respond: () => ({ data: null, error: null }) };

function query(table) {
  const state = { table, op: 'select', filters: {}, payload: null, head: false };
  const run = () => { fake.queries.push(state); return Promise.resolve({ data: null, error: null, ...fake.respond(state) }); };
  const chain = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') return (resolve, reject) => run().then(resolve, reject);
      if (prop === 'maybeSingle' || prop === 'single') return () => run();
      return (...args) => {
        if (prop === 'select') { state.columns = args[0]; state.head = Boolean(args[1]?.head); }
        else if (prop === 'eq') state.filters[args[0]] = args[1];
        else if (prop === 'insert' || prop === 'update') { state.op = prop; state.payload = args[0]; }
        return chain;
      };
    },
  });
  return chain;
}

export const supabase = { from: query, rpc: async () => ({ data: null, error: null }) };
