import React, { useState } from 'react';
import { useMediaPlayer } from '@/hooks/useMediaPlayer';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Zap, Settings, Music } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MediaPlayerSettings from '@/components/dashboard/admin/MediaPlayerSettings';
import { motion } from 'framer-motion';

const MediaPlayerWidget = () => {
    const {
        currentTrack,
        isPlaying,
        progress,
        duration,
        play,
        pause,
        togglePlay,
        next,
        previous,
        seek,
        isShuffle,
        isLoop,
        isCrossfade,
        toggleShuffle,
        toggleLoop,
        toggleCrossfade,
        refreshPlaylist
    } = useMediaPlayer();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleSeek = (value) => {
        seek(value[0]);
    };

    return (
        <div className="media-player-shell w-full max-w-xl mx-auto my-2 px-4">
             <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="media-player-glass overflow-hidden"
             >
                <div className="media-player-glass__content flex flex-col p-4 gap-3">
                    {/* Top Row: Track Info, Settings & Crossfade */}
                    <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                            <div className={cn("media-player-glass__art w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500", isPlaying ? "media-player-glass__art--playing scale-105" : "")}>
                                {isPlaying ? (
                                    <div className="flex items-end gap-0.5 h-4 pb-1">
                                        {[1,2,3].map(i => (
                                            <motion.div
                                                key={i}
                                                className="w-0.5 bg-white rounded-full"
                                                animate={{ height: [3, 10, 3] }}
                                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <Music className="w-5 h-5 text-slate-400" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="media-player-glass__title font-bold truncate text-sm leading-tight">
                                    {currentTrack?.title || "Tidak ada lagu"}
                                </h3>
                                <p className="media-player-glass__artist text-[10px] truncate leading-tight mt-0.5">
                                    {currentTrack?.artist || "Pilih lagu di pengaturan"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                             <Button
                                variant="ghost"
                                size="icon"
                                className={cn("media-player-glass__control h-8 w-8 rounded-full", isCrossfade && "media-player-glass__control--accent")}
                                onClick={toggleCrossfade}
                                title="Crossfade"
                            >
                                <Zap className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="media-player-glass__control h-8 w-8 rounded-full"
                                onClick={() => setIsSettingsOpen(true)}
                                title="Pengaturan & Playlist"
                            >
                                <Settings className="w-3.5 h-3.5 animate-spin-slow hover:animate-spin" style={{ animationDuration: '3s' }} />
                            </Button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="media-player-glass__progress flex items-center gap-2 text-[10px] font-medium w-full px-1">
                        <span className="w-7 text-right tabular-nums">{formatTime(progress)}</span>
                        <Slider
                            value={[progress]}
                            max={duration || 100}
                            step={1}
                            onValueChange={handleSeek}
                            className="media-player-glass__slider flex-1 cursor-pointer h-1.5"
                        />
                        <span className="w-7 tabular-nums">{formatTime(duration)}</span>
                    </div>

                    {/* Controls Row */}
                    <div className="media-player-glass__controls flex items-center justify-center gap-4 w-full">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("media-player-glass__control h-9 w-9 rounded-full transition-colors", isShuffle && "media-player-glass__control--active")}
                            onClick={toggleShuffle}
                            title="Acak (Shuffle)"
                        >
                            <Shuffle className="w-4 h-4" />
                        </Button>

                        <Button variant="ghost" size="icon" className="media-player-glass__control h-10 w-10 rounded-full" onClick={previous}>
                            <SkipBack className="w-5 h-5 fill-current" />
                        </Button>

                        <Button
                            className="media-player-glass__play h-14 w-14 rounded-full text-white transition-all flex items-center justify-center"
                            onClick={togglePlay}
                        >
                            {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
                        </Button>

                        <Button variant="ghost" size="icon" className="media-player-glass__control h-10 w-10 rounded-full" onClick={next}>
                            <SkipForward className="w-5 h-5 fill-current" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("media-player-glass__control h-9 w-9 rounded-full transition-colors", isLoop && "media-player-glass__control--active")}
                            onClick={toggleLoop}
                            title="Ulang (Loop)"
                        >
                            <Repeat className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
             </motion.div>

             <MediaPlayerSettings
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                onUpdate={refreshPlaylist}
                isShuffle={isShuffle}
                isLoop={isLoop}
                isCrossfade={isCrossfade}
                onToggleShuffle={toggleShuffle}
                onToggleLoop={toggleLoop}
                onToggleCrossfade={toggleCrossfade}
            />
        </div>
    );
};

export default MediaPlayerWidget;
