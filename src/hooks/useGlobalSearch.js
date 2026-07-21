import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { buildOrQuery, escapeSearchValue } from '@/utils/supabaseQueryBuilder';
import { resolveAvatarRecords } from '@/lib/storageAdapters';

export const useGlobalSearch = (query, delay = 300) => {
  const [results, setResults] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim() === '') {
      setResults({});
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const rawTerm = searchQuery.trim();
    const escapedTerm = escapeSearchValue(rawTerm);
    const isNumeric = !isNaN(parseInt(rawTerm));
    const numValue = isNumeric ? parseInt(rawTerm) : 0;

    try {
      const santriOr = buildOrQuery([
        { field: 'nama_lengkap', operator: 'ilike', value: escapedTerm },
        { field: 'nomor_induk_qiroati', operator: 'ilike', value: escapedTerm }
      ]);

      // Build local payment OR query
      let paymentLocalOr = `bulan.ilike.${escapedTerm},metode_pembayaran.ilike.${escapedTerm}`;
      if (isNumeric) {
         paymentLocalOr += `,tahun.eq.${numValue},jumlah.eq.${numValue}`;
      }

      // Helper to cleanly await a builder and catch errors, avoiding .catch() on a non-Promise builder object
      const safeQuery = async (queryBuilder) => {
        try {
          const res = await queryBuilder;
          return res;
        } catch (err) {
          console.error("Query builder caught error:", err);
          return { data: [], error: err };
        }
      };

      // Run queries in parallel with individual error catching
      const [santriRes, guruRes, classesRes, paySantriRes, payLocalRes] = await Promise.all([
        safeQuery(
          supabase.from('santri')
            .select('id, nama_lengkap, nomor_induk_qiroati, foto_url, avatar_path, status, jilid')
            .or(santriOr)
            .limit(5)
        ),
        safeQuery(
          supabase.from('guru')
            .select('id, nama, jabatan, foto_url, status_guru')
            .ilike('nama', escapedTerm)
            .limit(5)
        ),
        safeQuery(
          supabase.from('classes')
            .select('id, nama_kelas, sesi, guru:id_guru(nama)')
            .ilike('nama_kelas', escapedTerm)
            .limit(5)
        ),
        // Search payments by santri name via inner join
        safeQuery(
          supabase.from('payments')
            .select('id, jumlah, bulan, tahun, metode_pembayaran, tanggal_pembayaran, santri!inner(id, nama_lengkap)')
            .ilike('santri.nama_lengkap', escapedTerm)
            .limit(10)
        ),
        // Search payments by local fields (bulan, tahun, jumlah, metode_pembayaran)
        safeQuery(
          supabase.from('payments')
            .select('id, jumlah, bulan, tahun, metode_pembayaran, tanggal_pembayaran, santri(id, nama_lengkap)')
            .or(paymentLocalOr)
            .limit(10)
        )
      ]);

      // Collect any errors for logging, but don't fail the whole search if partial data exists
      const activeErrors = [santriRes.error, guruRes.error, classesRes.error, paySantriRes.error, payLocalRes.error].filter(Boolean);

      if (activeErrors.length > 0) {
        console.warn("Global search encountered partial errors:", activeErrors);
        // Only throw if ALL queries failed (assuming if santriRes is null/error and others too)
        if (!santriRes.data && !guruRes.data && !classesRes.data && !paySantriRes.data && !payLocalRes.data) {
           throw new Error("Terjadi kesalahan pada server saat mencari data. Silakan coba lagi.");
        }
      }

      const resolvedSantriResults = await resolveAvatarRecords(santriRes.data || [], {
        ownerType: 'santri',
      });
      const newResults = {};

      if (resolvedSantriResults.length > 0) newResults.santri = resolvedSantriResults;
      if (guruRes.data?.length > 0) newResults.guru = guruRes.data;
      if (classesRes.data?.length > 0) newResults.kelas = classesRes.data;

      // Merge and deduplicate payments
      const allPayments = [...(paySantriRes.data || []), ...(payLocalRes.data || [])];
      const uniquePayments = Array.from(new Map(allPayments.map(item => [item.id, item])).values());

      const validPayments = uniquePayments.filter(p => p.santri && p.santri.nama_lengkap);
      if (validPayments.length > 0) {
        newResults.pembayaran = validPayments.slice(0, 5);
      }

      setResults(newResults);
    } catch (err) {
      console.error("Global search exception:", err);
      setError("Gagal mengambil data pencarian. " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, performSearch, delay]);

  return { results, isLoading, error, performSearch };
};
