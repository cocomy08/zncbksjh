import React, { useState } from 'react';
import { ArrowLeft, Mic2, Play, Square, RefreshCw, AudioWaveform, User, Key } from 'lucide-react';

const VoiceSettings = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // 模拟播放
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // 模拟拉取模型
  const handleFetch = () => {
    setIsFetching(true);
    setTimeout(() => setIsFetching(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans antialiased flex justify-center items-center p-4 md:p-8">
      
      {/* Device Frame */}
      <div className="w-full max-w-[393px] bg-[#F5F5F7] rounded-[40px] shadow-2xl overflow-hidden relative border-[8px] border-black h-[852px] flex flex-col">
        
        {/* Status Bar */}
        <div className="h-14 flex justify-between items-center px-6 pt-2 z-20">
            <span className="text-sm font-semibold">9:41</span>
            <div className="flex gap-1.5 items-center">
                <div className="w-4 h-4 rounded-full bg-black/10"></div>
                <div className="w-4 h-4 rounded-full bg-black/10"></div>
                <div className="w-6 h-3.5 rounded-full border border-black/20"></div>
            </div>
        </div>

        {/* Header */}
        <div className="px-6 py-2 flex justify-between items-center z-20 bg-[#F5F5F7]/80 backdrop-blur-md sticky top-0">
          <button className="w-10 h-10 -ml-2 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 stroke-[2.5px]" />
          </button>
          <span className="text-sm font-bold tracking-widest uppercase text-black/40">Voice</span>
          <div className="w-10"></div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pt-4 pb-24 no-scrollbar px-6 space-y-6">
          
          {/* Section 1: Engine Credentials */}
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-black/5">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
                    <AudioWaveform className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold tracking-widest uppercase text-black/40">MiniMax Engine</span>
             </div>

             <div className="space-y-6">
                 {/* Group ID Input */}
                 <div className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-[16px] bg-[#F5F5F7] flex items-center justify-center text-black/30">
                        <User className="w-5 h-5 stroke-[2px]" />
                    </div>
                    <div className="flex-1 border-b border-black/5 pb-2 group-focus-within:border-black transition-colors">
                        <label className="block text-[10px] font-bold text-black/30 uppercase tracking-wider mb-1">Group ID</label>
                        <input type="text" placeholder="123456..." className="w-full text-base font-medium bg-transparent focus:outline-none placeholder-black/10 font-mono" />
                    </div>
                 </div>

                 {/* API Key Input */}
                 <div className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-[16px] bg-[#F5F5F7] flex items-center justify-center text-black/30">
                        <Key className="w-5 h-5 stroke-[2px]" />
                    </div>
                    <div className="flex-1 border-b border-black/5 pb-2 group-focus-within:border-black transition-colors">
                        <label className="block text-[10px] font-bold text-black/30 uppercase tracking-wider mb-1">API Key</label>
                        <input type="password" placeholder="eyJ..." className="w-full text-base font-medium bg-transparent focus:outline-none placeholder-black/10 font-mono tracking-widest" />
                    </div>
                 </div>
             </div>
          </div>

          {/* Section 2: Model Selection (Fetch Action) */}
          <div className="bg-white rounded-[32px] p-1 shadow-sm border border-black/5">
             <div className="p-5 flex items-center justify-between">
                <div>
                    <label className="block text-[10px] font-bold text-black/30 uppercase tracking-wider mb-1">Voice Model</label>
                    <div className="text-lg font-bold text-[#1D1D1F]">Male-01 (Standard)</div>
                </div>
                <button 
                    onClick={handleFetch}
                    className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-black/10"
                >
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
             </div>
          </div>

          {/* Section 3: Sound Test (Visualizer) */}
          <div className={`
            rounded-[32px] p-6 shadow-sm border transition-all duration-300 relative overflow-hidden
            ${isPlaying ? 'bg-[#1D1D1F] border-black/5' : 'bg-white border-black/5'}
          `}>
             
             {/* Dynamic Waveform Background (Mock) */}
             {isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-20">
                    {[...Array(20)].map((_, i) => (
                        <div 
                            key={i} 
                            className="w-2 bg-white rounded-full animate-pulse"
                            style={{ 
                                height: `${Math.random() * 60 + 20}%`,
                                animationDuration: `${Math.random() * 0.5 + 0.3}s` 
                            }}
                        ></div>
                    ))}
                </div>
             )}

             <div className="relative z-10 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className={`text-xs font-bold uppercase tracking-widest mb-1 ${isPlaying ? 'text-white/40' : 'text-black/40'}`}>
                        {isPlaying ? 'Playing...' : 'Sound Test'}
                    </span>
                    <span className={`text-xl font-bold ${isPlaying ? 'text-white' : 'text-[#1D1D1F]'}`}>
                        Hello, World.
                    </span>
                </div>

                <button 
                    onClick={togglePlay}
                    className={`
                        w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl
                        ${isPlaying ? 'bg-white text-black scale-110' : 'bg-[#007AFF] text-white hover:bg-[#0062CC]'}
                    `}
                >
                    {isPlaying ? (
                        <Square className="w-5 h-5 fill-current" />
                    ) : (
                        <Play className="w-6 h-6 fill-current ml-1" />
                    )}
                </button>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default VoiceSettings;