import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Short } from '../types';
import { Play, Pause, FastForward, Rewind, Maximize2, Type, Layers, Music, SlidersHorizontal, Image as ImageIcon, Video } from 'lucide-react';
import { cn } from '../lib/utils';

const Player: any = ReactPlayer;

interface EditorPreviewProps {
  short: Short;
  url: string;
}

export default function EditorPreview({ short, url }: EditorPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(short.start);
  const [activeTab, setActiveTab] = useState<'captions' | 'overlay' | 'adjust'>('captions');
  // Caption Settings
  const [captionColor, setCaptionColor] = useState('#FBBF24');
  const [captionStyle, setCaptionStyle] = useState('karaoke');
  const [watermark, setWatermark] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  
  // Find current active caption
  const absoluteTime = currentTime;
  const currentCaption = short.captions?.find(c => absoluteTime >= c.start && absoluteTime <= c.end);

  const handleProgress = (state: any) => {
    setCurrentTime(state.playedSeconds);
    // Auto loop within the short boundaries
    if (state.playedSeconds >= short.end) {
      playerRef.current?.seekTo(short.start);
      setPlaying(false);
      setTimeout(() => setPlaying(true), 100);
    }
  };

  const currentZoom = short.zoom_points?.slice().reverse().find(z => z.time <= (currentTime - short.start))?.scale || short.zoom_points?.[0]?.scale || 1.1;

  // Initialize player to start time
  const handleReady = () => {
    playerRef.current?.seekTo(short.start);
  };

  const duration = short.end - short.start;
  const progressPercent = Math.max(0, Math.min(100, ((currentTime - short.start) / duration) * 100));

  return (
    <div className="flex flex-col xl:flex-row gap-6 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-2xl text-slate-200 mt-6 relative overflow-hidden">
      {/* Background glow for Electric Purple accent */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      {/* LEFT: Video Preview */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-[320px] mx-auto aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-slate-800 relative group">
          
          <div 
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              transform: `scale(${currentZoom})`, 
              transformOrigin: `${(short.crop_x_center || 0.5) * 100}% 50%`,
              transition: 'transform 0.3s ease-in-out'
            }}
          >
            <div className="absolute top-0 w-[177.77vh] h-full max-w-none" style={{
                left: '50%',
                transform: `translateX(-${(short.crop_x_center || 0.5) * 100}%)`,
              }}>
               <Player
                 ref={playerRef}
                 url={url}
                 playing={playing}
                 controls={false}
                 width="100%"
                 height="100%"
                 onProgress={handleProgress}
                 onReady={handleReady}
                 style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                 onClick={() => setPlaying(!playing)}
               />
            </div>
          </div>

          {/* Overlays (Watermark) */}
          {watermark && (
            <div className="absolute top-4 right-4 z-20 pointer-events-none opacity-80">
              <span className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded backdrop-blur-sm">@TwójZnakWodny</span>
            </div>
          )}

          {/* Captions Overlay */}
          {currentCaption && (
            <div className="absolute inset-x-0 bottom-32 flex justify-center z-20 pointer-events-none px-4">
              <span 
                className={cn(
                  "font-black uppercase text-2xl px-4 py-2 text-center rounded-md shadow-2xl transform transition-all duration-100",
                  captionStyle === 'karaoke' ? 'scale-110' : '',
                  captionStyle === 'netflix' ? 'bg-black/70 text-white font-medium text-lg' : 'bg-transparent text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]'
                )}
                style={captionStyle !== 'netflix' ? { color: captionColor, textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' } : {}}
              >
                {currentCaption.text}
              </span>
            </div>
          )}

          {/* Transport Controls Overlay */}
          <div className="absolute bottom-4 inset-x-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-2 flex items-center justify-between z-30 shadow-xl">
             <button onClick={() => { playerRef.current?.seekTo(short.start); setCurrentTime(short.start); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
               <Rewind size={18} />
             </button>
             <button onClick={() => setPlaying(!playing)} className="w-10 h-10 bg-purple-600 hover:bg-purple-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-purple-600/30 transition-all transform hover:scale-105">
               {playing ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-1" />}
             </button>
             <button onClick={() => { playerRef.current?.seekTo(short.end); setCurrentTime(short.end); }} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
               <FastForward size={18} />
             </button>
          </div>
        </div>
      </div>

      {/* RIGHT/BOTTOM: Editor Tools & Timeline */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Toolbar Tabs */}
        <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button onClick={() => setActiveTab('captions')} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all", activeTab === 'captions' ? "bg-slate-800 text-purple-400 shadow-sm" : "text-slate-500 hover:text-slate-300")}>
            <Type size={16} /> Napisy
          </button>
          <button onClick={() => setActiveTab('overlay')} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all", activeTab === 'overlay' ? "bg-slate-800 text-purple-400 shadow-sm" : "text-slate-500 hover:text-slate-300")}>
            <ImageIcon size={16} /> Nakładki
          </button>
          <button onClick={() => setActiveTab('adjust')} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all", activeTab === 'adjust' ? "bg-slate-800 text-purple-400 shadow-sm" : "text-slate-500 hover:text-slate-300")}>
            <SlidersHorizontal size={16} /> Zoom / Pan
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex-1 shadow-inner">
          {activeTab === 'captions' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Styl Animacji</label>
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => setCaptionStyle('karaoke')} className={cn("p-3 rounded-xl border flex flex-col gap-1 items-center justify-center transition-all", captionStyle === 'karaoke' ? "border-purple-500 bg-purple-500/10 text-purple-300" : "border-slate-700 bg-slate-800 text-slate-400")}>
                     <Sparkles size={20} className={captionStyle === 'karaoke' ? "text-purple-400" : ""} />
                     <span className="text-xs font-bold">Dynamiczne (Karaoke)</span>
                   </button>
                   <button onClick={() => setCaptionStyle('netflix')} className={cn("p-3 rounded-xl border flex flex-col gap-1 items-center justify-center transition-all", captionStyle === 'netflix' ? "border-purple-500 bg-purple-500/10 text-purple-300" : "border-slate-700 bg-slate-800 text-slate-400")}>
                     <Layers size={20} />
                     <span className="text-xs font-bold">Klasyczne (Tło)</span>
                   </button>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Kolor Główny</label>
                <div className="flex gap-3">
                  {['#FBBF24', '#FFFFFF', '#10B981', '#EF4444', '#A855F7', '#3B82F6'].map(color => (
                    <button 
                      key={color} 
                      onClick={() => setCaptionColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full shadow-inner ring-offset-2 ring-offset-slate-900 transition-all", 
                        captionColor === color ? "ring-2 ring-purple-500 scale-110" : "hover:scale-105"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'overlay' && (
            <div className="space-y-6">
               <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Znak Wodny (Watermark)</label>
                  <label className="flex items-center gap-3 p-4 border border-slate-700 rounded-xl bg-slate-800 cursor-pointer hover:border-slate-600 transition-colors">
                    <input type="checkbox" checked={watermark !== null} onChange={(e) => setWatermark(e.target.checked ? 'on' : null)} className="accent-purple-600 w-5 h-5 rounded" />
                    <span className="text-sm font-medium text-slate-300">Wyświetl Mój Znak Wodny</span>
                  </label>
               </div>
            </div>
          )}

          {activeTab === 'adjust' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Śledzenie Twarzy (Crop Target X)</label>
                <div className="px-4">
                   <input type="range" min="0" max="1" step="0.01" defaultValue={short.crop_x_center || 0.5} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                   <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
                     <span>Lewo</span>
                     <span>Środek (Wykryto AI)</span>
                     <span>Prawo</span>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TIMELINE UI */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-inner flex flex-col gap-2">
           <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Layers size={14}/> Oś Czasu (Timeline)</span>
              <span className="text-xs font-mono text-purple-400 font-bold">{(currentTime - short.start).toFixed(2)}s / {duration.toFixed(2)}s</span>
           </div>

           {/* Playhead Track */}
           <div className="relative h-4 mb-2 cursor-pointer" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              const newTime = short.start + (percent * duration);
              playerRef.current?.seekTo(newTime);
              setCurrentTime(newTime);
           }}>
             <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 rounded-full"></div>
             {/* Interpolated Zoom visual points */}
             {short.zoom_points?.map((z, i) => (
                <div key={i} className="absolute top-1/2 -ml-1.5 -mt-1.5 w-3 h-3 bg-purple-500 rounded-full border border-slate-900" style={{ left: `${(z.time / duration) * 100}%` }} title={`Zoom: ${Math.round(z.scale * 100)}%`}></div>
             ))}
             {/* Playhead */}
             <div className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-50 pointer-events-none" style={{ left: `${progressPercent}%` }}>
                <div className="absolute -top-1 -ml-[3px] w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-red-500"></div>
             </div>
           </div>

           {/* Video Layer */}
           <div className="flex items-center gap-3">
             <div className="w-16 text-right text-[10px] font-bold text-slate-500 uppercase flex items-center justify-end gap-1"><Video size={10} /> Wideo</div>
             <div className="flex-1 h-8 bg-indigo-900/40 rounded-md border border-indigo-500/30 overflow-hidden relative">
               <div className="absolute inset-0 pattern-diagonal-lines pattern-slate-800 pattern-size-2 pattern-opacity-20 pointer-events-none"></div>
             </div>
           </div>

           {/* Audio Waveform Layer */}
           <div className="flex items-center gap-3">
             <div className="w-16 text-right text-[10px] font-bold text-slate-500 uppercase flex items-center justify-end gap-1"><Music size={10} /> Audio</div>
             <div className="flex-1 h-8 bg-emerald-900/20 rounded-md border border-emerald-500/20 overflow-hidden flex items-center px-1 gap-[1px]">
               {/* Mock Waveform */}
               {Array.from({ length: 120 }).map((_, i) => (
                 <div key={i} className="flex-1 bg-emerald-500/50 rounded-full" style={{ height: `${20 + Math.random() * 80}%`, opacity: i % 5 === 0 ? 0.8 : 0.4 }}></div>
               ))}
             </div>
           </div>

           {/* Captions Layer */}
           <div className="flex items-center gap-3">
             <div className="w-16 text-right text-[10px] font-bold text-slate-500 uppercase flex items-center justify-end gap-1"><Type size={10} /> Napisy</div>
             <div className="flex-1 h-8 bg-amber-900/20 rounded-md border border-amber-500/30 overflow-hidden relative">
                {short.captions?.map((cap, i) => {
                   const startPct = ((cap.start - short.start) / duration) * 100;
                   const widthPct = ((cap.end - cap.start) / duration) * 100;
                   return (
                     <div key={i} className="absolute h-full bg-amber-500/30 border-l border-amber-500/50 hover:bg-amber-500/50 cursor-pointer group flex items-center justify-center px-1" style={{ left: `${startPct}%`, width: `${widthPct}%` }}>
                       <span className="text-[8px] font-mono font-bold text-amber-200 truncate opacity-0 group-hover:opacity-100">{cap.text}</span>
                     </div>
                   );
                })}
             </div>
           </div>

        </div>
      </div>
    </div>
  );
}
