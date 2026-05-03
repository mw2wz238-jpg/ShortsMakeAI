import React, { useState, useRef } from 'react';
import ReactPlayer from 'react-player';
import { Short } from '../types';

const Player: any = ReactPlayer;

interface EditorPreviewProps {
  short: Short;
  url: string;
}

export default function EditorPreview({ short, url }: EditorPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<any>(null);
  
  // Find current active caption
  const absoluteTime = short.start + currentTime;
  const currentCaption = short.captions?.find(c => absoluteTime >= c.start && absoluteTime <= c.end);

  const handleProgress = (state: any) => {
    setCurrentTime(state.playedSeconds);
    // Auto loop
    if (state.playedSeconds >= (short.end - short.start)) {
      playerRef.current?.seekTo(0);
      setPlaying(false);
      setTimeout(() => setPlaying(true), 100);
    }
  };

  const handlePlay = () => setPlaying(true);
  const handlePause = () => setPlaying(false);

  // Calculate dynamic zoom based on current video time relative to short start
  const currentZoom = short.zoom_points?.slice().reverse().find(z => z.time <= currentTime)?.scale || short.zoom_points?.[0]?.scale || 1.3;

  return (
    <div className="flex flex-col gap-4">
      {/* Video Container rendering as 9:16 aspect ratio */}
      <div className="relative w-full max-w-[300px] mx-auto aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-xl border-4 border-slate-900 group">
        <div 
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            transform: `scale(${currentZoom})`, // dynamic zoom based on playing time
            transformOrigin: `${(short.crop_x_center || 0.5) * 100}% 50%`,
            transition: 'transform 0.3s ease-in-out'
          }}
        >
          {/* We use an oversized video container inside the crop and shift it to simulate crop */}
          <div className="absolute top-0 w-[177.77vh] h-full max-w-none" style={{
              left: '50%',
              transform: `translateX(-${(short.crop_x_center || 0.5) * 100}%)`,
            }}>
             <Player
               ref={playerRef}
               url={`${url}?start=${Math.floor(short.start)}&end=${Math.ceil(short.end)}`}
               playing={playing}
               controls={false}
               width="100%"
               height="100%"
               onProgress={handleProgress}
               onPlay={handlePlay}
               onPause={handlePause}
               onEnded={() => {
                 playerRef.current?.seekTo(0);
                 setPlaying(true);
               }}
               style={{ pointerEvents: 'auto' }} // Allow clicking to play/pause
               config={({
                 youtube: {
                   playerVars: { 
                     controls: 0,
                     modestbranding: 1,
                     rel: 0,
                     disablekb: 1,
                     start: Math.floor(short.start),
                     end: Math.ceil(short.end)
                   }
                 }
               }) as any}
             />
          </div>
        </div>

        {/* Captions Overlay */}
        {currentCaption && (
          <div className="absolute inset-x-0 bottom-24 flex justify-center z-20 pointer-events-none">
            <span className="bg-yellow-400 text-black font-black uppercase text-xl px-3 py-1 rounded-sm shadow-black shadow-lg transform -rotate-2">
              {currentCaption.text}
            </span>
          </div>
        )}

        {/* Play UI Overlay when paused */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30 pointer-events-none">
            <div className="w-16 h-16 bg-white/30 backdrop-blur-md text-white border-2 border-white/50 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                <path d="M10.804 8 5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z"/>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Editor Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
          </svg>
          Editing Blueprint
        </h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Crop Target (X-Center)</label>
            <input type="range" min="0" max="1" step="0.01" defaultValue={short.crop_x_center || 0.5} className="w-full accent-indigo-600" />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Left</span>
              <span>Center</span>
              <span>Right</span>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Detailed Captions</label>
            <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-100 p-2 rounded-lg bg-slate-50">
              {short.captions && short.captions.length > 0 ? (
                short.captions.map((cap, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 py-1 w-12 text-right shrink-0">{cap.start.toFixed(1)}s</span>
                    <input type="text" defaultValue={cap.text} className="flex-1 text-sm bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400 text-center py-4 italic">No precise captions generated.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
