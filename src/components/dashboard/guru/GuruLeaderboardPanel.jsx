import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Eye, RefreshCw, Star, Trophy, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  fetchGlobalLeaderboardPage,
  fetchLeaderboardPage,
  getLeaderboardRank,
} from '@/lib/leaderboardAdapters';

const PREVIEW_PAGE_SIZE = 5;
const SCOPE_KEY = 'lpq.guru-leaderboard.scope';
const SCOPES = [
  { id: 'kelas', label: 'Kelas saya' },
  { id: 'global', label: 'Semua santri' },
];
const readScope = () => {
  try { return window.localStorage.getItem(SCOPE_KEY) === 'global' ? 'global' : 'kelas'; } catch { return 'kelas'; }
};

const getLeaderboardErrorMessage = (error) => {
  if (error?.code === 'GLOBAL_LEADERBOARD_UNAVAILABLE') return error.message;
  if (error?.message?.toLowerCase().includes('row-level security')) {
    return 'Akun ini belum memiliki akses baca leaderboard.';
  }
  return 'Leaderboard belum dapat dimuat. Coba lagi beberapa saat.';
};

const GuruLeaderboardPanel = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [scope, setScope] = useState(readScope);

  const chooseScope = (next) => {
    setScope(next);
    try { window.localStorage.setItem(SCOPE_KEY, next); } catch { /* penyimpanan lokal tidak tersedia */ }
  };

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const fetchPage = scope === 'global' ? fetchGlobalLeaderboardPage : fetchLeaderboardPage;
      const result = await fetchPage({ page: 1, pageSize: PREVIEW_PAGE_SIZE });
      setStudents(result.students);
      setTotalStudents(result.totalStudents);
    } catch (loadError) {
      console.error('Guru leaderboard could not be loaded:', loadError);
      setStudents([]);
      setTotalStudents(0);
      setError(getLeaderboardErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <section className="guru-leaderboard-panel" aria-labelledby="guru-leaderboard-title">
      <div className="guru-leaderboard-panel__aurora" aria-hidden="true" />
      <header className="guru-leaderboard-panel__header">
        <div className="guru-leaderboard-panel__heading">
          <span className="guru-leaderboard-panel__icon" aria-hidden="true"><Trophy /></span>
          <div>
            <p className="guru-leaderboard-panel__eyebrow">Prestasi santri</p>
            <h2 id="guru-leaderboard-title">Leaderboard poin</h2>
            <p>{scope === 'global' ? 'Peringkat poin seluruh santri LPQ.' : 'Peringkat poin santri di kelas yang Anda ampu.'}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="guru-leaderboard-panel__action"
          onClick={() => navigate('/top-score')}
        >
          Lihat semua <ArrowUpRight aria-hidden="true" />
        </Button>
      </header>

      <div className="relative px-3 pt-3">
      <div className="inline-flex rounded-full border border-border bg-background/70 p-1" role="radiogroup" aria-label="Cakupan leaderboard">
        {SCOPES.map(({ id, label }) => (
          <button key={id} type="button" role="radio" aria-checked={scope === id} onClick={() => chooseScope(id)}
            className={cn('min-h-[36px] rounded-full px-4 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              scope === id ? 'bg-teal-600 text-white shadow-sm' : 'text-foreground/70 hover:bg-muted')}>
            {label}
          </button>
        ))}
      </div>
      </div>

      <div className="guru-leaderboard-panel__body">
        {isLoading && (
          <div className="guru-leaderboard-panel__list" aria-label="Memuat leaderboard" aria-busy="true">
            {Array.from({ length: PREVIEW_PAGE_SIZE }, (_, index) => (
              <div key={index} className="guru-leaderboard-panel__skeleton" aria-hidden="true" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="guru-leaderboard-panel__state" role="alert">
            <p>{error}</p>
            <Button type="button" variant="outline" onClick={loadLeaderboard}>
              <RefreshCw aria-hidden="true" /> Coba lagi
            </Button>
          </div>
        )}

        {!isLoading && !error && students.length === 0 && (
          <div className="guru-leaderboard-panel__state" role="status">
            <Users aria-hidden="true" />
            <p>Belum ada santri yang dapat ditampilkan di leaderboard.</p>
          </div>
        )}

        {!isLoading && !error && students.length > 0 && (
          <ol className="guru-leaderboard-panel__list" aria-label="Peringkat santri berdasarkan poin">
            {students.map((student, index) => (
              <li key={student.id} className="guru-leaderboard-panel__row">
                <span className="guru-leaderboard-panel__rank" aria-label={`Peringkat ${getLeaderboardRank({ index, pageSize: PREVIEW_PAGE_SIZE })}`}>
                  {getLeaderboardRank({ index, pageSize: PREVIEW_PAGE_SIZE })}
                </span>
                <Avatar className="guru-leaderboard-panel__avatar">
                  <AvatarImage src={student.foto_url} alt="" loading={index < 2 ? 'eager' : 'lazy'} decoding="async" />
                  <AvatarFallback aria-hidden="true">{student.nama_lengkap?.charAt(0) || 'S'}</AvatarFallback>
                </Avatar>
                <div className="guru-leaderboard-panel__student">
                  <strong>{student.nama_lengkap}</strong>
                  <span>{student.sesi_mengaji || 'Sesi belum diatur'} · {student.jilid || 'Jilid belum diatur'}</span>
                </div>
                <div className="guru-leaderboard-panel__points">
                  <Star aria-hidden="true" />
                  <strong>{student.points ?? 0}</strong>
                  <span>poin</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {!isLoading && !error && totalStudents > 0 && (
        <footer className="guru-leaderboard-panel__footer">
          <span><Eye aria-hidden="true" /> Mode baca saja</span>
          <span>{Math.min(PREVIEW_PAGE_SIZE, totalStudents)} dari {totalStudents} santri</span>
        </footer>
      )}
    </section>
  );
};

export default GuruLeaderboardPanel;
