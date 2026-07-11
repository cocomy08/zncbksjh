import React, { useState } from 'react';
import { ArrowLeft, Library, Save, Link2, Zap, CheckCircle2, ChevronDown } from 'lucide-react';

const ModelSettings = () => {
  const [temperature, setTemperature] = useState(0.7);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // 模拟连接测试
  const handleConnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
    }, 1500);
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
          <span className="text-sm font-bold tracking-widest uppercase text-black/40">Model</span>
          <div className="flex gap-2">
            <button className="w-10 h-10 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors">
                <Library className="w-5 h-5 stroke-[2px]" />
            </button>
            <button className="w-10 h-10 flex items-center justify-center bg-black text-white rounded-full transition-transform active:scale-95 shadow-lg shadow-black/10">
                <Save className="w-4 h-4 stroke-[2.5px]" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pt-4 pb-24 no-scrollbar px-6 space-y-6">
          
          {/* Section 1: Neural Connection (API) */}
          <div className="bg-white rounded-[32px] p-1 shadow-sm border border-black/5">
             <div className="p-6 pb-2">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isConnected ? 'bg-[#32D74B]/10 text-[#32D74B]' : 'bg-black/5 text-black/40'}`}>
                        <Link2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase text-black/40">Neural Link</span>
                </div>
                
                {/* Inputs */}
                <div className="space-y-6">
                    <div className="group">
                        <label className="block text-[10px] font-bold text-black/30 uppercase tracking-wider mb-1">Endpoint URL</label>
                        <input type="text" placeholder="https://api.openai.com/v1" className="w-full text-lg font-medium bg-transparent border-b border-black/10 py-1 focus:border-black transition-colors focus:outline-none placeholder-black/10 font-mono" />
                    </div>
                    <div className="group">
                        <label className="block text-[10px] font-bold text-black/30 uppercase tracking-wider mb-1">Secret Key</label>
                        <input type="password" placeholder="sk-..." className="w-full text-lg font-medium bg-transparent border-b border-black/10 py-1 focus:border-black transition-colors focus:outline-none placeholder-black/10 font-mono tracking-widest" />
                    </div>
                </div>
             </div>

             {/* Action Button */}
             <div className="p-2 mt-2">
                <button 
                    onClick={handleConnect}
                    className={`w-full h-12 rounded-[24px] font-semibold text-sm transition-all flex items-center justify-center gap-2
                    ${isConnected ? 'bg-[#32D74B] text-white shadow-lg shadow-[#32D74B]/20' : 'bg-[#F5F5F7] text-black hover:bg-[#E5E5EA]'}`}
                >
                    {isConnecting ? (
                        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                    ) : isConnected ? (
                        <>Connected <CheckCircle2 className="w-4 h-4" /></>
                    ) : (
                        "Test Connection"
                    )}
                </button>
             </div>
          </div>

          {/* Section 2: Brain Config (Model & Temp) */}
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-black/5">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold tracking-widest uppercase text-black/40">Brain Config</span>
             </div>

             {/* Model Selector Card */}
             <div className="relative mb-8 group cursor-pointer">
                <label className="block text-[10px] font-bold text-black/30 uppercase tracking-wider mb-2">Model</label>
                <div className="flex items-center justify-between bg-[#F5F5F7] p-4 rounded-[20px] group-hover:bg-[#E5E5EA] transition-colors">
                    <div className="flex flex-col">
                        <span className="text-lg font-bold text-[#1D1D1F]">GPT-4 Turbo</span>
                        <span className="text-xs text-black/40 font-medium">128k Context Window</span>
                    </div>
                    <ChevronDown className="w-5 h-5 text-black/40" />
                </div>
             </div>

             {/* Temperature Visualizer */}
             <div>
                <div className="flex justify-between items-end mb-4">
                    <label className="text-[10px] font-bold text-black/30 uppercase tracking-wider">Creativity (Temp)</label>
                    <span className="text-xl font-bold font-mono text-[#1D1D1F]">{temperature}</span>
                </div>
                
                {/* Custom Swiss Slider */}
                <div className="relative h-12 flex items-center select-none">
                    {/* Track */}
                    <div className="absolute w-full h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
                        <div className="h-full bg-[#FF3B30]" style={{ width: `${(temperature / 2) * 100}%` }}></div>
                    </div>
                    
                    {/* Ticks */}
                    <div className="absolute w-full flex justify-between px-1 opacity-20 pointer-events-none">
                        {[0, 0.5, 1, 1.5, 2].map(t => (
                            <div key={t} className="w-px h-4 bg-black"></div>
                        ))}
                    </div>

                    {/* Thumb */}
                    <input 
                        type="range" min="0" max="2" step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full opacity-0 z-20 cursor-pointer"
                    />
                    <div 
                        className="absolute w-8 h-8 bg-white border border-black/5 shadow-md rounded-full flex items-center justify-center pointer-events-none transition-all"
                        style={{ left: `calc(${(temperature / 2) * 100}% - 16px)` }}
                    >
                        <div className="w-2 h-2 bg-[#FF3B30] rounded-full"></div>
                    </div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-black/20 uppercase mt-2">
                    <span>Precise</span>
                    <span>Balanced</span>
                    <span>Creative</span>
                </div>
             </div>
          </div>
          
          {/* Quick Action */}
          <button className="w-full py-4 text-sm font-semibold text-black/40 hover:text-black transition-colors">
            Save Configuration to Library
          </button>

        </div>
      </div>
    </div>
  );
};

export default ModelSettings;