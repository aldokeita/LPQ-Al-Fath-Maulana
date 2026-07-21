
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export const useMediaPlayer = () => {
    const [playlist, setPlaylist] = useState([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isShuffle, setIsShuffle] = useState(() => localStorage.getItem('mp_shuffle') === 'true');
    const [isLoop, setIsLoop] = useState(() => localStorage.getItem('mp_loop') === 'true');
    const [isCrossfade, setIsCrossfade] = useState(() => localStorage.getItem('mp_crossfade') === 'true');
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [settingsId, setSettingsId] = useState(null);
    const audioRef = useRef(new Audio());
    const handleNextTrackRef = useRef(null);

    // Fetch Playlist
    const fetchPlaylist = useCallback(async () => {
        const { data, error } = await supabase
            .from('music_files')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (error) {
            setPlaylist([]);
            setCurrentTrackIndex(-1);
            return;
        }
        const tracks = data || [];
        setPlaylist(tracks);
        setCurrentTrackIndex((prev) => (tracks.length > 0 && prev === -1 ? 0 : prev));
    }, [currentTrackIndex]);

    useEffect(() => {
        fetchPlaylist();

        // Fetch saved settings from Supabase
        const fetchSettings = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('media_player_settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (data) {
                setSettingsId(data.id);
                // Prefer DB settings if they exist
                if (data.shuffle_enabled !== null) setIsShuffle(data.shuffle_enabled);
                // Notice: We use playback_position instead of the reserved current_time keyword
                if (data.playback_position) {
                    audioRef.current.currentTime = data.playback_position;
                    setProgress(data.playback_position);
                }
            } else if (!error) {
                // Initialize default settings for user
                const { data: newSettings } = await supabase
                    .from('media_player_settings')
                    .insert([{ user_id: user.id, playback_position: 0 }])
                    .select()
                    .single();

                if (newSettings) setSettingsId(newSettings.id);
            }
        };
        fetchSettings();

        // Audio Event Listeners
        const audio = audioRef.current;

        const updateProgress = () => {
            setProgress(audio.currentTime);
            setDuration(audio.duration || 0);
        };

        const handleEnded = () => {
            handleNextTrackRef.current?.(true);
        };

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('loadedmetadata', updateProgress);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('loadedmetadata', updateProgress);
            audio.pause();
        };
    }, []);

    // Sync progress to DB periodically (throttled)
    useEffect(() => {
        const syncInterval = setInterval(async () => {
            if (settingsId && isPlaying) {
                await supabase
                    .from('media_player_settings')
                    .update({
                        playback_position: Math.floor(progress), // Used corrected column name
                        is_playing: isPlaying,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', settingsId);
            }
        }, 10000); // Sync every 10 seconds

        return () => clearInterval(syncInterval);
    }, [progress, isPlaying, settingsId]);

    // Handle Playback Change
    useEffect(() => {
        const audio = audioRef.current;
        if (currentTrackIndex >= 0 && playlist[currentTrackIndex]) {
            const track = playlist[currentTrackIndex];
            if (audio.src !== track.file_url) {
                audio.src = track.file_url;
                audio.load();
                if (isPlaying) {
                    audio.play().catch(e => console.error("Play failed", e));
                }
            }
        }
    }, [currentTrackIndex, playlist]);

    // Handle Play/Pause State
    useEffect(() => {
        const audio = audioRef.current;
        if (currentTrackIndex >= 0 && playlist.length > 0) {
            if (isPlaying) {
                audio.play().catch(e => console.error("Play failed", e));
            } else {
                audio.pause();
            }
        }
    }, [isPlaying, currentTrackIndex]);

    // Handle Volume (for Crossfade or general use)
    useEffect(() => {
        audioRef.current.volume = volume;
    }, [volume]);

    const play = () => setIsPlaying(true);
    const pause = () => setIsPlaying(false);
    const togglePlay = () => setIsPlaying(!isPlaying);

    const seek = (time) => {
        audioRef.current.currentTime = time;
        setProgress(time);

        // Immediate sync on explicit seek
        if (settingsId) {
            supabase.from('media_player_settings')
                .update({ playback_position: Math.floor(time) })
                .eq('id', settingsId);
        }
    };

    const handleNextTrack = (auto = false) => {
        if (playlist.length === 0) return;

        let nextIndex;
        if (isShuffle) {
            do {
                nextIndex = Math.floor(Math.random() * playlist.length);
            } while (playlist.length > 1 && nextIndex === currentTrackIndex);
        } else {
            nextIndex = currentTrackIndex + 1;
            if (nextIndex >= playlist.length) {
                if (isLoop) nextIndex = 0;
                else {
                    setIsPlaying(false);
                    return;
                }
            }
        }

        if (isCrossfade && auto) {
            const fadeOut = setInterval(() => {
                if (audioRef.current.volume > 0.1) {
                    audioRef.current.volume -= 0.1;
                } else {
                    clearInterval(fadeOut);
                    setCurrentTrackIndex(nextIndex);
                    audioRef.current.volume = 1;
                }
            }, 200);
        } else {
            setCurrentTrackIndex(nextIndex);
        }

        if (!isPlaying) setIsPlaying(true);
    };

    handleNextTrackRef.current = handleNextTrack;

    const previous = () => {
        if (playlist.length === 0) return;

        if (audioRef.current.currentTime > 3) {
            audioRef.current.currentTime = 0;
            return;
        }

        let prevIndex;
        if (isShuffle) {
             do {
                prevIndex = Math.floor(Math.random() * playlist.length);
            } while (playlist.length > 1 && prevIndex === currentTrackIndex);
        } else {
            prevIndex = currentTrackIndex - 1;
            if (prevIndex < 0) prevIndex = playlist.length - 1;
        }

        setCurrentTrackIndex(prevIndex);
        if (!isPlaying) setIsPlaying(true);
    };

    const next = () => handleNextTrack(false);

    const toggleShuffle = () => {
        const newVal = !isShuffle;
        setIsShuffle(newVal);
        localStorage.setItem('mp_shuffle', newVal);
        if (settingsId) {
            supabase.from('media_player_settings').update({ shuffle_enabled: newVal }).eq('id', settingsId);
        }
    };

    const toggleLoop = () => {
        const newVal = !isLoop;
        setIsLoop(newVal);
        localStorage.setItem('mp_loop', newVal);
    };

    const toggleCrossfade = () => {
        const newVal = !isCrossfade;
        setIsCrossfade(newVal);
        localStorage.setItem('mp_crossfade', newVal);
    };

    return {
        currentTrack: playlist[currentTrackIndex],
        isPlaying,
        isShuffle,
        isLoop,
        isCrossfade,
        progress,
        duration,
        playlist,
        play,
        pause,
        togglePlay,
        next,
        previous,
        seek,
        toggleShuffle,
        toggleLoop,
        toggleCrossfade,
        refreshPlaylist: fetchPlaylist
    };
};
