import { supabase } from '@/lib/customSupabaseClient';

/**
 * Utility functions for building safe and correct Supabase PostgREST queries.
 * Handles escaping, logic trees, and formatting to prevent PGRST100 errors.
 */

/**
 * Escapes a search value for use in ILIKE queries.
 * Removes characters that could break the query syntax and wraps it in wildcards.
 *
 * @param {string} value - The raw search input from the user
 * @returns {string} The escaped value wrapped in % for wildcard matching
 */
export const escapeSearchValue = (value) => {
  if (!value) return '';

  // Remove double quotes as they are used as string delimiters in PostgREST logic
  const cleanValue = value.replace(/"/g, '').trim();

  return `%${cleanValue}%`;
};

/**
 * Builds a properly formatted OR query string for the Supabase .or() method.
 * Supabase PostgREST requires comma-separated conditions.
 * CRITICAL: Values containing spaces or commas MUST be wrapped in double quotes
 * inside the string, otherwise it causes "failed to parse logic tree" (PGRST100).
 *
 * @param {Array<{field: string, operator: string, value: string}>} conditions
 * @returns {string} Properly formatted OR string for Supabase .or() filter
 *
 * @example
 * buildOrQuery([
 *   { field: 'item_name', operator: 'ilike', value: '%gibran%' },
 *   { field: 'nama_lengkap', operator: 'ilike', value: '%gibran%' }
 * ])
 * // Returns: 'item_name.ilike."%gibran%",nama_lengkap.ilike."%gibran%"'
 */
export const buildOrQuery = (conditions) => {
  if (!conditions || conditions.length === 0) return '';

  return conditions.map(c => {
    // Wrapping the value in double quotes prevents commas/spaces inside the value
    // from being interpreted as a new OR condition by the PostgREST parser.
    return `${c.field}.${c.operator}."${c.value}"`;
  }).join(',');
};

/**
 * Utility to construct a standard search query payload string.
 * Useful for abstracting simple multi-field searches on a single table.
 *
 * @param {string} table - The table name
 * @param {Array<string>} searchFields - Fields to search against
 * @param {string} searchValue - The raw string to search
 * @returns {Object} An object containing table and the formatted OR string
 */
export const buildSearchQuery = (table, searchFields, searchValue) => {
  const escapedValue = escapeSearchValue(searchValue);

  const conditions = searchFields.map(field => ({
    field,
    operator: 'ilike',
    value: escapedValue
  }));

  return {
    table,
    orString: buildOrQuery(conditions)
  };
};

/**
 * Executes a search query safely, returning a proper Promise.
 *
 * @param {string} table - The table name to query
 * @param {Array<string>} selectFields - Fields to select (e.g., 'id, name')
 * @param {Array<string>} searchFields - Fields to perform ILIKE search against
 * @param {string} searchValue - The raw search value
 * @param {number} limit - Max number of results (default 5)
 * @returns {Promise<{data: any[], error: any}>} Resolves with standard Supabase response object
 */
export const executeSearchQuery = async (table, selectFields, searchFields, searchValue, limit = 5) => {
  try {
    const { orString } = buildSearchQuery(table, searchFields, searchValue);
    const result = await supabase
      .from(table)
      .select(selectFields.join(', '))
      .or(orString)
      .limit(limit);

    return result;
  } catch (error) {
    console.error(`Error executing search on ${table}:`, error);
    return { data: null, error };
  }
};
