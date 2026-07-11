import React, { useState } from 'react';
import { ArrowLeft, Database, DownloadCloud, UploadCloud, ShieldCheck, Clock, FileJson, CheckCircle2 } from 'lucide-react';

const DataSettings = () => {
  const [backupStatus, setBackupStatus] = useState('idle'); // idle, processing, success
  const [lastBackupTime, setLastBackupTime] = useState('Today, 9:41 AM');

  const handleBackup = () => {
    setBackupStatus('processing');
    setTimeout(() => {
      setBackupStatus('success');
      setLastBackupTime('Just now');
      setTimeout(() => setBackupStatus('idle'), 3000);
    }, 2000);
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
          <span className="text-sm font-bold tracking-widest uppercase text-black/40">Data</span>
          <div className="w-10"></div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pt-4 pb-24 no-scrollbar px-6 space-y-6">
          
          {/* Section 1: Data Health Hero (The Shield) */}
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-black/5 relative overflow-hidden group">
             {/* Decorative Background */}
             <div className="absolute top-0 right-0 p-8 opacity-[0.03] transform group-hover:scale-110 transition-transform duration-500">
                <Database className="w-32 h-32" />
             </div>

             <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`
                    w-20 h-20 rounded-[24px] flex items-center justify-center shadow-inner mb-4 border border-white transition-colors duration-500
                    ${backupStatus === 'success' ? 'bg-[#32D74B]/10 text-[#32D74B]' : 'bg-gray-50 text-black/60'}
                `}>
                    {backupStatus === 'processing' ? (
                        <div className="w-8 h-8 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : backupStatus === 'success' ? (
                        <CheckCircle2 className="w-10 h-10" />
                    ) : (
                        <ShieldCheck className="w-10 h-10 stroke-[1.5px]" />
                    )}
                </div>
                
                <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F] mb-1">
                    {backupStatus === 'success' ? 'Backup Complete' : 'Data Secure'}
                </h1>
                
                <div className="flex items-center gap-1.5 mt-1 bg-black/5 px-3 py-1 rounded-full">
                    <Clock className="w-3 h-3 text-black/40" />
                    <span className="text-[10px] font-bold text-black/40 uppercase tracking-wider">
                        Last: {lastBackupTime}
                    </span>
                </div>
             </div>
          </div>

          {/* Section 2: Action Grid (Tiles) */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Export Card */}
            <button 
                onClick={handleBackup}
                disabled={backupStatus === 'processing'}
                className="bg-white rounded-[28px] p-5 border border-black/5 shadow-sm flex flex-col justify-between h-40 hover:bg-gray-50 transition-all active:scale-95 text-left group"
            >
                <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg shadow-black/10 group-hover:scale-110 transition-transform">
                    <DownloadCloud className="w-5 h-5" />
                </div>
                <div>
                    <span className="block text-[10px] font-bold text-black/40 uppercase tracking-wider mb-1">Export</span>
                    <span className="text-lg font-bold text-[#1D1D1F] leading-tight">Create<br/>Backup</span>
                </div>
            </button>

            {/* Import Card */}
            <button className="bg-white rounded-[28px] p-5 border border-black/5 shadow-sm flex flex-col justify-between h-40 hover:bg-gray-50 transition-all active:scale-95 text-left group">
                <div className="w-10 h-10 rounded-full bg-gray-100 text-black flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                    <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                    <span className="block text-[10px] font-bold text-black/40 uppercase tracking-wider mb-1">Import</span>
                    <span className="text-lg font-bold text-[#1D1D1F] leading-tight">Restore<br/>Data</span>
                </div>
            </button>

          </div>

          {/* Section 3: File Info (Visualizer) */}
          <div className="bg-[#1D1D1F] rounded-[32px] p-6 text-white shadow-lg shadow-black/10 relative overflow-hidden">
             <div className="flex items-start justify-between mb-8 relative z-10">
                 <div>
                     <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">Format</span>
                     <span className="text-2xl font-bold font-mono">JSON</span>
                 </div>
                 <FileJson className="w-6 h-6 text-white/30" />
             </div>

             {/* Code Decoration */}
             <div className="font-mono text-[10px] text-white/20 leading-relaxed overflow-hidden h-16 relative z-10">
                {"{"}<br/>
                &nbsp;&nbsp;"user_id": "8x92...",<br/>
                &nbsp;&nbsp;"settings": {"{"}...{"}"},<br/>
                &nbsp;&nbsp;"chats": [...]<br/>
                {"}"}
             </div>

             {/* Background Decoration */}
             <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
          </div>
          
          <div className="text-center">
             <p className="text-[10px] text-black/30 font-medium max-w-[200px] mx-auto leading-relaxed">
                Backups include all chat history, prompt templates, and API configurations.
             </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DataSettings;