import { useState, useEffect } from 'react';

const HISTORY_KEY = 'lpq_global_search_history';
const MAX_HISTORY = 10;

export const useSearchHistory = (enabled = true) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (enabled) {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        try {
          setHistory(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse search history", e);
        }
      }
    }
  }, [enabled]);

  const addToHistory = (query) => {
    if (!enabled || !query || query.trim() === '') return;

    const trimmedQuery = query.trim();
    setHistory((prev) => {
      // Remove if exists to move to top
      const filtered = prev.filter(q => q.toLowerCase() !== trimmedQuery.toLowerCase());
      const newHistory = [trimmedQuery, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const removeFromHistory = (query) => {
    setHistory((prev) => {
      const newHistory = prev.filter(q => q !== query);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return { history, addToHistory, removeFromHistory, clearHistory };
};
