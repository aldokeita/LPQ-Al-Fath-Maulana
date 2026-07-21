import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import SearchResultsDropdown from './SearchResultsDropdown';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

const GlobalSearch = ({ onNavigate }) => {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Optimized debounce implementation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 400); // 400ms delay to prevent rapid queries

    return () => clearTimeout(timer);
  }, [inputValue]);

  const { results, isLoading, error, performSearch } = useGlobalSearch(debouncedQuery);
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();

  useEffect(() => {
    if (error) {
      toast({
        title: "Pencarian Gagal",
        description: error,
        variant: "destructive"
      });
    }
  }, [error, toast]);

  const flattenedResults = useMemo(() => {
    const flat = [];
    if (results) {
      Object.entries(results).forEach(([category, items]) => {
        items.forEach(item => {
          flat.push({ category, data: item });
        });
      });
    }
    return flat;
  }, [results]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [debouncedQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen && e.key !== 'Escape') {
      setIsOpen(true);
    }

    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < flattenedResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flattenedResults.length) {
        const selected = flattenedResults[selectedIndex];
        handleSelect(selected.data, selected.category);
      } else if (inputValue.trim() !== '') {
        addToHistory(inputValue);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  }, [isOpen, flattenedResults, selectedIndex, inputValue, addToHistory]);

  const handleSelect = (item, category) => {
    const searchHistoryText = inputValue || item.nama_lengkap || item.nama || item.nama_kelas || item.santri?.nama_lengkap || '';
    if (searchHistoryText) addToHistory(searchHistoryText);

    setIsOpen(false);
    setInputValue('');
    setDebouncedQuery('');

    if (category === 'kelas' && item.id) {
      navigate(`/dashboard?tab=kelas`, { state: { classId: item.id } });
      toast({
        title: "Navigasi Berhasil",
        description: `Membuka detail kelas ${item.nama_kelas}`,
      });
    } else if (category === 'pembayaran' && item.santri) {
      navigate(`/dashboard?tab=payments`, { state: { santriId: item.santri.id, santriName: item.santri.nama_lengkap } });
      toast({
        title: "Navigasi Berhasil",
        description: `Membuka sistem pembayaran ${item.santri.nama_lengkap}`,
      });
    } else if (onNavigate) {
      onNavigate(item, category);
    }
  };

  const handleHistorySelect = (historicalQuery) => {
    setInputValue(historicalQuery);
    setIsOpen(true);
    // Removed auto focus to prevent cursor jumping
  };

  const handleRetry = () => {
    performSearch(debouncedQuery);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto z-[45]" ref={containerRef}>
      <div
        className={`relative flex items-center transition-all duration-300 rounded-full border-2 ${
          isOpen
            ? 'border-primary/50 bg-white dark:bg-slate-900 shadow-xl shadow-primary/10'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <Search className={`absolute left-4 w-5 h-5 transition-colors ${isOpen ? 'text-primary' : 'text-slate-400'}`} />

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Cari santri, guru, kelas, pembayaran..."
          className={`w-full bg-transparent border-none py-3.5 pl-12 pr-12 text-sm sm:text-base outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100 rounded-full font-medium ${isLoading ? 'opacity-80' : ''}`}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="search-results"
        />

        {isLoading ? (
            <Loader2 className="absolute right-4 w-4 h-4 text-primary animate-spin" />
        ) : inputValue && (
          <button
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent input from losing focus
              setInputValue('');
              setDebouncedQuery('');
            }}
            className="absolute right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <SearchResultsDropdown
            results={results}
            isLoading={isLoading}
            error={error}
            query={debouncedQuery}
            history={history}
            onSelect={handleSelect}
            onHistorySelect={handleHistorySelect}
            onRemoveHistory={removeFromHistory}
            onClearAllHistory={clearHistory}
            selectedIndex={selectedIndex}
            flattenedResults={flattenedResults}
            onRetry={handleRetry}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlobalSearch;
