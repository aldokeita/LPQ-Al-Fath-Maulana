import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Gamepad2, Star, Sparkles, Crown, UserCheck, Gift, RefreshCw, CheckCircle2, Monitor, Smartphone, Sun, Moon, MessageCircle } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
const GatchaGamePage = () => {
  const navigate = useNavigate();
  const {
    isDark,
    toggleTheme
  } = useTheme();
  const [orientation, setOrientation] = useState('landscape');
  const [santriList, setSantriList] = useState([]);
  const [selectedSantriId, setSelectedSantriId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [isRosterLoading, setIsRosterLoading] = useState(true);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);

  // Game States
  // IDLE -> pilih santri -> WAIT_VALIDATION -> validasi guru -> REWARD_SPIN -> REWARD_SHOW
  const [gameState, setGameState] = useState('IDLE');
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [activeReward, setActiveReward] = useState(null);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [config, setConfig] = useState({
    challenges: [],
    rewards: []
  });

  // Initial Config Load
  useEffect(() => {
    const loadConfig = async () => {
      const {
        data
      } = await supabase.from('website_content').select('content').eq('key', 'gatcha_config').maybeSingle();
      if (data?.content) {
        setConfig(data.content);
      } else {
        // Defaults
        setConfig({
          rewards: [{
            type: "points",
            value: 10,
            label: "10 Poin",
            weight: 50
          }, {
            type: "item",
            value: "Snack",
            label: "Snack",
            weight: 50
          }]
        });
      }
    };
    const loadRoster = async () => {
      setIsRosterLoading(true);
      const { data, error } = await supabase
        .from('santri')
        .select('id, nama_lengkap, nama_panggilan, foto_url, avatar_path, jilid, points, status')
        .order('nama_lengkap', { ascending: true });

      if (!error) {
        setSantriList((data || []).filter((santri) => santri.status !== 'inactive'));
      }
      setIsRosterLoading(false);
    };

    loadConfig();
    loadRoster();
  }, []);

  // Timer for resetting game if abandoned
  useEffect(() => {
    let timeout;
    if (gameState !== 'IDLE' && gameState !== 'REWARD_SHOW') {
      timeout = setTimeout(() => {
        resetGame();
      }, 60000); // 1 minute timeout
    }
    return () => clearTimeout(timeout);
  }, [gameState]);
  const resetGame = () => {
    setGameState('IDLE');
    setCurrentPlayer(null);
    setActiveReward(null);
    setActiveChallenge(null);
    setSelectedSantriId('');
    setStudentSearch('');
  };
  const pickRandom = items => {
    if (!items || items.length === 0) return null;
    if (items[0].weight) {
      // Weighted random
      const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
      let random = Math.random() * totalWeight;
      for (const item of items) {
        random -= item.weight || 1;
        if (random <= 0) return item;
      }
      return items[0];
    }
    return items[Math.floor(Math.random() * items.length)];
  };
  const filteredSantri = santriList.filter((santri) => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return true;
    return [santri.nama_lengkap, santri.nama_panggilan, santri.jilid]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const startSelectedPlayer = async () => {
    const selected = santriList.find((santri) => String(santri.id) === String(selectedSantriId));
    if (!selected) return;

    setIsPlayerLoading(true);
    const foto_url = await resolveAvatarUrl({
      ownerType: 'santri',
      ownerId: selected.id,
      avatarPath: selected.avatar_path,
      fallbackUrl: selected.foto_url,
    });
    setCurrentPlayer({ ...selected, foto_url });
    setActiveChallenge(pickRandom(config.challenges));
    setGameState('WAIT_VALIDATION');
    setIsPlayerLoading(false);
  };

  const processRewardSpin = async () => {
    setGameState('REWARD_SPIN');
    setTimeout(async () => {
      const reward = pickRandom(config.rewards);
      if (!reward) {
        setGameState('IDLE');
        return;
      }

      setActiveReward(reward);
      if (reward.type === 'points' && currentPlayer) {
        const amount = Number.parseInt(reward.value, 10) || 0;
        const nextPoints = (Number(currentPlayer.points) || 0) + amount;
        const { error: rpcError } = await supabase.rpc('increment_santri_points', {
          p_santri_id: currentPlayer.id,
          p_amount: amount
        });

        if (rpcError) {
          await supabase.from('santri').update({ points: nextPoints }).eq('id', currentPlayer.id);
        }

        setCurrentPlayer(prev => ({
          ...prev,
          points: nextPoints
        }));
      }
      setGameState('REWARD_SHOW');
      setTimeout(resetGame, 15000);
    }, 3000);
  };
  return <>
            <Helmet><title>Gatcha Challenge - LPQ Al-Fath Maulana</title></Helmet>
            <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} relative overflow-hidden flex flex-col transition-colors duration-300`}>
                {/* Background Animations */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
                    <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse-slow" style={{
          animationDelay: '2s'
        }}></div>
                    <div className={`absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-spin-slow ${isDark ? '' : 'invert'}`} style={{
          animationDuration: '60s'
        }}></div>
                </div>

                {/* Header */}
                <div className="relative z-10 p-4 md:p-6 flex justify-between items-center">
                    <Button variant="ghost" onClick={() => navigate('/absensi-digital')} className={`${isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}>
                        <ArrowLeft className="w-6 h-6 mr-2" /> Kembali
                    </Button>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md ${isDark ? 'bg-white/10 border border-white/10' : 'bg-white/50 border border-slate-200 shadow-sm'}`}>
                        <Gamepad2 className="w-5 h-5 text-yellow-500" />
                        <span className="font-bold tracking-wider text-yellow-500 hidden md:inline">GACHA GAME </span>
                    </div>
                    <div className="flex items-center gap-2">
                         <Button variant="outline" size="icon" onClick={() => setOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')} className={`${isDark ? 'border-white/20 hover:bg-white/10 text-white' : 'bg-white'}`}>
                             {orientation === 'landscape' ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                         </Button>
                         <Button variant="outline" size="icon" onClick={toggleTheme} className={`${isDark ? 'border-white/20 hover:bg-white/10 text-white' : 'bg-white'}`}>
                             {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
                         </Button>
                    </div>
                </div>

                {/* Main Stage */}
                <div className={`flex-1 flex flex-col items-center justify-center relative z-10 p-4 ${orientation === 'portrait' ? 'py-10' : ''}`}>
                    <AnimatePresence mode="wait">
                        {/* IDLE STATE */}
                        {gameState === 'IDLE' && <motion.div
                          key="idle"
                          initial={{ opacity: 0, scale: 0.94 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.04 }}
                          className="w-full max-w-xl text-center space-y-6"
                        >
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-fuchsia-500 blur-3xl opacity-25 rounded-full animate-pulse"></div>
                            <Gamepad2 className={`relative w-28 h-28 md:w-36 md:h-36 mx-auto drop-shadow-[0_0_18px_rgba(245,158,11,0.45)] ${isDark ? 'text-white' : 'text-slate-800'}`} />
                          </div>
                          <div>
                            <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-fuchsia-500 to-violet-500 mb-3">GACHA TIME!</h1>
                            <p className={`text-base md:text-lg ${isDark ? 'text-white/65' : 'text-slate-600'}`}>Pilih santri yang akan bermain.</p>
                          </div>
                          <div className={`rounded-3xl p-5 md:p-6 backdrop-blur-xl ${isDark ? 'bg-white/8 shadow-[0_18px_50px_rgba(0,0,0,0.35)]' : 'bg-white/70 shadow-[0_18px_50px_rgba(71,85,105,0.16)]'}`}>
                            <Input
                              value={studentSearch}
                              onChange={(event) => setStudentSearch(event.target.value)}
                              placeholder="Cari nama, panggilan, atau jilid..."
                              className={`mb-3 h-12 ${isDark ? 'bg-slate-900/70 border-white/10 text-white' : 'bg-white/90'}`}
                            />
                            <select
                              value={selectedSantriId}
                              onChange={(event) => setSelectedSantriId(event.target.value)}
                              className={`w-full h-12 rounded-xl px-4 text-sm font-semibold outline-none ${isDark ? 'bg-slate-900/80 text-white' : 'bg-white text-slate-800'}`}
                              disabled={isRosterLoading}
                            >
                              <option value="">{isRosterLoading ? 'Memuat santri...' : 'Pilih santri'}</option>
                              {filteredSantri.map((santri) => (
                                <option key={santri.id} value={santri.id}>
                                  {santri.nama_lengkap}{santri.jilid ? ` — ${santri.jilid}` : ''}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              size="lg"
                              onClick={startSelectedPlayer}
                              disabled={!selectedSantriId || isPlayerLoading}
                              className="mt-4 w-full h-12 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 text-white font-black shadow-lg shadow-violet-500/25"
                            >
                              <Sparkles className="w-5 h-5 mr-2" /> {isPlayerLoading ? 'Menyiapkan Pemain...' : 'Mulai Tantangan'}
                            </Button>
                          </div>
                        </motion.div>}

                        {/* WAIT VALIDATION (Guru Asking Question) */}
                        {gameState === 'WAIT_VALIDATION' && currentPlayer && <motion.div key="wait_validation" initial={{
            rotateX: 90,
            opacity: 0
          }} animate={{
            rotateX: 0,
            opacity: 1
          }} className={`max-w-3xl w-full border-4 border-blue-500 rounded-[3rem] p-8 md:p-12 text-center shadow-[0_0_50px_rgba(59,130,246,0.3)] relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-white/90 backdrop-blur-xl'}`}>
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 animate-gradient-x"></div>

                                <div className="flex justify-center mb-6">
                                    <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                                        <AvatarImage src={currentPlayer?.foto_url} loading="eager" fetchPriority="high" decoding="async" />
                                        <AvatarFallback>{currentPlayer?.nama_lengkap?.[0]}</AvatarFallback>
                                    </Avatar>
                                </div>

                                <h3 className={`text-2xl font-bold mb-4 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>Halo, {currentPlayer?.nama_panggilan}!</h3>

                                <div className={`py-8 px-6 rounded-2xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                                    <div className="flex flex-col items-center gap-4">
                                        <MessageCircle className="w-16 h-16 text-yellow-500 animate-bounce" />
                                        <p className={`text-xl md:text-3xl font-black leading-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                            {activeChallenge?.text || activeChallenge?.label || 'Jawab tantangan dari Guru'}
                                        </p>
                                        {activeChallenge?.difficulty && (
                                          <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-black uppercase tracking-widest text-yellow-500">
                                            Level {activeChallenge.difficulty}
                                          </span>
                                        )}
                                        <p className="text-sm opacity-70">Dengarkan arahan guru, lalu jawab dengan lantang dan benar!</p>
                                    </div>
                                </div>

                                <div className={`mt-8 p-6 rounded-2xl ${isDark ? 'bg-blue-900/25' : 'bg-blue-50'}`}>
                                  <div className="flex flex-col items-center gap-4">
                                    <UserCheck className="w-9 h-9 text-green-500" />
                                    <p className={`text-base font-semibold ${isDark ? 'text-white/75' : 'text-slate-600'}`}>Guru menilai jawaban secara langsung.</p>
                                    <Button
                                      type="button"
                                      size="lg"
                                      onClick={processRewardSpin}
                                      className="w-full max-w-md rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black shadow-lg shadow-emerald-500/25"
                                    >
                                      <CheckCircle2 className="w-5 h-5 mr-2" /> Jawaban Benar — Putar Hadiah
                                    </Button>
                                  </div>
                                </div>
                            </motion.div>}

                        {/* REWARD SPINNING */}
                        {gameState === 'REWARD_SPIN' && <motion.div className="text-center">
                                <h2 className="text-4xl font-bold text-yellow-500 mb-8">Mengacak Hadiah...</h2>
                                <div className="flex justify-center gap-4">
                                    {[1, 2, 3].map(i => <motion.div key={i} animate={{
                y: [0, -50, 0]
              }} transition={{
                duration: 0.5,
                repeat: Infinity,
                delay: i * 0.1
              }} className="w-24 h-32 bg-gradient-to-b from-yellow-400 to-orange-500 rounded-xl border-4 border-white"></motion.div>)}
                                </div>
                            </motion.div>}

                        {/* REWARD REVEALED */}
                        {gameState === 'REWARD_SHOW' && activeReward && <motion.div key="reward_show" initial={{
            scale: 0,
            rotate: 180
          }} animate={{
            scale: 1,
            rotate: 0
          }} transition={{
            type: "spring",
            bounce: 0.5
          }} className="max-w-2xl w-full bg-gradient-to-b from-yellow-500 via-orange-500 to-red-600 p-1 rounded-[3rem] shadow-[0_0_100px_rgba(234,179,8,0.5)]">
                                <div className={`rounded-[2.8rem] p-10 text-center h-full relative overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>

                                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                                        <Sparkles className="absolute top-10 left-10 text-yellow-300 w-8 h-8 animate-ping" />
                                        <Sparkles className="absolute bottom-10 right-10 text-yellow-300 w-8 h-8 animate-ping" style={{
                  animationDelay: '0.5s'
                }} />
                                    </div>

                                    <h2 className="text-3xl font-bold text-yellow-500 mb-6 tracking-widest uppercase">🎉 CONGRATULATIONS 🎉</h2>

                                    <div className="relative inline-block mb-8">
                                        <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-50 rounded-full"></div>
                                        <Avatar className="w-40 h-40 border-[6px] border-white shadow-2xl relative z-10">
                                            <AvatarImage src={currentPlayer?.foto_url} loading="eager" fetchPriority="high" decoding="async" />
                                            <AvatarFallback>{currentPlayer?.nama_panggilan?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-4 -right-4 bg-white text-orange-600 p-2 rounded-full border-4 border-orange-600 z-20 shadow-lg">
                                            <Crown className="w-8 h-8" fill="currentColor" />
                                        </div>
                                    </div>

                                    <h3 className={`text-4xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>{currentPlayer?.nama_lengkap}</h3>
                                    <p className="text-slate-400 mb-8 font-mono">Kamu Mendapatkan:</p>

                                    <div className={`p-6 rounded-2xl shadow-inner mb-8 transform hover:scale-105 transition-transform ${isDark ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-900'}`}>
                                        <div className="flex items-center justify-center gap-4">
                                            {activeReward.type === 'points' ? <Star className="w-12 h-12 text-yellow-500 fill-yellow-500 animate-spin-slow" /> : <Gift className="w-12 h-12 text-purple-600 animate-bounce" />}
                                            <span className="text-5xl font-black tracking-tighter">{activeReward.label}</span>
                                        </div>
                                        {activeReward.type === 'points' && <p className="text-green-600 font-bold mt-2 text-lg">+ {activeReward.value} Poin Ditambahkan!</p>}
                                    </div>

                                    <Button onClick={resetGame} variant="ghost" className={`${isDark ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}>
                                        <RefreshCw className="w-4 h-4 mr-2" /> Main Lagi
                                    </Button>
                                </div>
                            </motion.div>}
                    </AnimatePresence>

                </div>

            </div>
        </>;
};
export default GatchaGamePage;
