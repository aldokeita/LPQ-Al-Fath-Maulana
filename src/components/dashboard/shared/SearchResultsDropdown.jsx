import React, { useEffect, useRef } from 'react';
import SearchResultItem from './SearchResultItem';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, History, Loader2, AlertCircle, RefreshCw, X, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const CATEGORY_LABELS = {
  santri: 'Data Santri',
  guru: 'Data Guru',
  kelas: 'Manajemen Kelas',
  pembayaran: 'Data Pembayaran'
};

const SearchResultsDropdown = ({
  results,
  isLoading,
  error,
  query,
  history,
  onSelect,
  onHistorySelect,
  onRemoveHistory,
  onClearAllHistory,
  selectedIndex,
  flattenedResults,
  onRetry
}) => {
  const hasResults = Object.keys(results).length > 0;
  const showHistory = !query && history && history.length > 0;
  const scrollRef = useRef(null);

  useEffect(() => {
    if (selectedIndex >= 0 && scrollRef.current) {
      const selectedEl = scrollRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onMouseDown={(e) => e.preventDefault()} // Prevent input blur when clicking inside the dropdown
      className="absolute top-full left-0 right-0 mt-2 w-full max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 shadow-2xl rounded-2xl z-40 flex flex-col ring-1 ring-black/5 overscroll-contain"
    >
      {isLoading ? (
        <div className="p-8 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium animate-pulse">Mencari data...</p>
        </div>
      ) : error ? (
        <div className="p-6 flex flex-col items-center justify-center text-red-500 text-center">
          <AlertCircle className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-sm font-medium mb-4">{error}</p>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" /> Coba Lagi
          </button>
        </div>
      ) : showHistory ? (
        <div className="p-2">
          <div className="px-3 py-2 flex justify-between items-center">
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-2 uppercase tracking-wider">
              <History className="w-3.5 h-3.5" /> Pencarian Terakhir
            </div>
            {history.length > 1 && onClearAllHistory && (
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onClearAllHistory();
                }}
                className="text-[10px] text-red-500 hover:text-red-700 font-medium flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Hapus Semua
              </button>
            )}
          </div>
          <ul className="space-y-1 mt-1">
            {history.map((h, i) => (
              <li
                key={`${h}-${i}`}
                className="group flex items-center justify-between px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-lg transition-all cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onHistorySelect(h);
                }}
              >
                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <Search className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">{h}</span>
                </div>
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onRemoveHistory(h);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-50 dark:hover:bg-red-900/30"
                  title="Hapus pencarian ini"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : hasResults ? (
        <div className="p-2" ref={scrollRef}>
          {Object.entries(results).map(([category, items]) => {
            if (!items || items.length === 0) return null;
            return (
              <div key={category} className="mb-4 last:mb-0">
                <div className="sticky top-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md z-10 px-3 py-2 flex justify-between items-center rounded-lg mb-1 shadow-sm border-b border-slate-100/50 dark:border-slate-800/50">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {CATEGORY_LABELS[category] || category}
                  </h3>
                  {items.length >= 5 && (
                    <span className="text-[10px] text-primary hover:text-primary/80 font-medium hover:underline cursor-pointer transition-colors px-2 py-1 rounded-md hover:bg-primary/5">
                      Lihat semua
                    </span>
                  )}
                </div>
                <div className="space-y-1 mt-1">
                  {items.map((item, idx) => {
                    const globalIdx = flattenedResults.findIndex(
                      f => f.category === category && f.data.id === item.id
                    );

                    return (
                      <div key={item.id || idx} data-index={globalIdx}>
                        <SearchResultItem
                          item={item}
                          category={category}
                          onSelect={onSelect}
                          isSelected={globalIdx === selectedIndex}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : query ? (
        <div className="p-10 flex flex-col items-center justify-center text-slate-500 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <Search className="w-8 h-8 opacity-40" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Tidak ada hasil ditemukan</p>
          <p className="text-xs text-slate-500">Coba gunakan kata kunci lain untuk "{query}"</p>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 text-sm font-medium">
          Ketik kata kunci untuk mencari data...
        </div>
      )}
    </motion.div>
  );
};

export default SearchResultsDropdown;
