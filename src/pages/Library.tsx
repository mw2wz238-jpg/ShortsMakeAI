import React, { useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AuthContext } from '../AuthContext';
import { Job } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { Play, Loader2, MoreVertical, Trash2, Scissors, Download, ExternalLink, Calendar, Video, Library as LibraryIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

import EditorPreview from '../components/EditorPreview';

export default function Library() {
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'jobs'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Job[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'jobs'));
    return unsubscribe;
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this extraction history?')) return;
    try {
      await deleteDoc(doc(db, 'jobs', id));
      toast.success('Extraction deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const renderVideo = async (job: Job, shortIndex: number) => {
    const short = job.shorts![shortIndex];
    if (!job.shorts) return;
    
    const newShorts = [...job.shorts];
    newShorts[shortIndex] = { ...short, renderStatus: 'rendering', renderProgress: 0 };
    await updateDoc(doc(db, 'jobs', job.id), { shorts: newShorts, updatedAt: Date.now() });

    try {
      const res = await fetch('/api/functions/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, shortIndex, short, url: job.url })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      // Start polling
      const renderId = data.renderId;
      const interval = setInterval(async () => {
         try {
           const pollRes = await fetch(`/api/functions/render-progress?id=${renderId}`);
           const pollData = await pollRes.json();
           
           if (pollData.status === 'rendering') {
              const updatedShorts = [...job.shorts!];
              updatedShorts[shortIndex] = { ...updatedShorts[shortIndex], renderStatus: 'rendering', renderProgress: pollData.progress };
              await updateDoc(doc(db, 'jobs', job.id), { shorts: updatedShorts, updatedAt: Date.now() });
           } else if (pollData.status === 'finished') {
              clearInterval(interval);
              const finishedShorts = [...job.shorts!];
              finishedShorts[shortIndex] = { ...finishedShorts[shortIndex], renderStatus: 'finished', finalVideoUrl: pollData.finalVideoUrl, renderProgress: 100 };
              await updateDoc(doc(db, 'jobs', job.id), { shorts: finishedShorts, updatedAt: Date.now() });
              toast.success('Wideo zostało wygenerowane!');
           } else if (pollData.status === 'error') {
              clearInterval(interval);
              const errorShorts = [...job.shorts!];
              errorShorts[shortIndex] = { ...errorShorts[shortIndex], renderStatus: 'error' };
              await updateDoc(doc(db, 'jobs', job.id), { shorts: errorShorts, updatedAt: Date.now() });
              toast.error('Błąd renderowania: ' + pollData.error);
           }
         } catch(e) {
            console.error(e);
         }
      }, 3000);

    } catch (err) {
      console.error("Render failed", err);
      const errorShorts = [...job.shorts!];
      errorShorts[shortIndex] = { ...short, renderStatus: 'error' };
      await updateDoc(doc(db, 'jobs', job.id), { shorts: errorShorts, updatedAt: Date.now() });
      toast.error('Nie udało się uruchomić renderowania');
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('library_title')}</h1>
          <p className="text-slate-500 mt-2">{t('library_subtitle')}</p>
        </div>
        <Link 
          to="/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-sm"
        >
          <Scissors size={18} /> {t('menu_new')}
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 border-dashed rounded-3xl text-slate-400">
           <LibraryIcon size={48} className="opacity-20 mb-4" />
           <p className="font-medium">{t('library_empty')}</p>
           <Link to="/new" className="text-indigo-600 hover:underline mt-2 flex items-center gap-1">
              {t('start_extracting')} <ExternalLink size={16} />
           </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {jobs.map(job => (
            <div key={job.id} className="bg-white border text-left border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col gap-6 relative">
              <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-slate-100 pb-6">
                <div className="flex gap-4">
                  <div className="hidden sm:flex bg-slate-100 w-24 h-24 rounded-2xl items-center justify-center flex-shrink-0 text-slate-400">
                     <Video size={32} />
                  </div>
                  <div>
                    <a href={job.url} target="_blank" rel="noreferrer" className="text-lg font-bold text-slate-900 hover:text-indigo-600 hover:underline line-clamp-2 transition-colors flex items-center gap-2">
                       {job.url} <ExternalLink size={16} className="opacity-50" />
                    </a>
                    
                    <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-3">
                       <span className={cn(
                         "inline-flex px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider",
                          job.status === 'completed' ? "bg-emerald-100 text-emerald-700" : 
                          job.status === 'error' ? "bg-red-100 text-red-700" : 
                          "bg-amber-100 text-amber-700 animate-pulse"
                       )}>
                          {job.status}
                       </span>
                       
                       <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <Calendar size={14} /> {formatDistanceToNow(job.createdAt, { addSuffix: true })}
                       </span>

                       {job.settings?.targetPlatform && (
                         <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg capitalize">
                            Target: {job.settings.targetPlatform.replace('_', ' ')}
                         </span>
                       )}
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center justify-end gap-2 shrink-0">
                   <button 
                     onClick={() => handleDelete(job.id)}
                     className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                     title="Delete this extraction"
                   >
                     <Trash2 size={20} />
                   </button>
                </div>
              </div>

              {job.status === 'error' && (
                <div className="bg-red-50 text-red-800 p-5 rounded-2xl text-sm font-medium border border-red-100 leading-relaxed">
                   <strong className="block mb-1 text-red-900 font-bold">{t('extraction_failed')}</strong>
                   {job.error}
                </div>
              )}

      {job.status === 'completed' && job.shorts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {job.shorts.map((short, i) => {
            const isPlaying = activeVideoId === `${job.id}-${i}`;

            return (
              <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 group hover:border-indigo-300 hover:bg-slate-50/50 transition-colors">
                
                <div className="flex justify-between items-start gap-4">
                   <h4 className="font-bold text-slate-900 leading-tight flex-1">
                     {short.title}
                   </h4>
                   <span className="text-xs font-mono font-bold text-slate-500 bg-slate-200/50 px-2 py-1 rounded-lg shrink-0">
                     {formatDuration(short.start)} - {formatDuration(short.end)}
                   </span>
                </div>
                
                <p className="text-sm text-slate-600 leading-relaxed">
                  {short.description}
                </p>

                {/* Viral Architect Additions */}
                <div className="flex flex-col gap-3 mt-1 pb-1">
                  {short.viralScore !== undefined && (
                    <div className="flex items-center gap-2">
                       <span className="flex items-center gap-1 text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md">
                          ⚡ Viral Score: {short.viralScore}/100
                       </span>
                    </div>
                  )}
                  {short.newHookScript && (
                    <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                      <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest block mb-1">AI Voiceover Hook</span>
                      <p className="text-sm font-medium text-indigo-900 italic">"{short.newHookScript}"</p>
                    </div>
                  )}
                  {short.retentionHacks && short.retentionHacks.length > 0 && (
                    <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-1">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-widest block mb-1">Retention Hacks</span>
                      <ul className="text-sm text-slate-600 space-y-1 list-disc pl-4 marker:text-emerald-500">
                         {short.retentionHacks.map((hack, hi) => (
                           <li key={hi}>{hack}</li>
                         ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-auto">
                    <EditorPreview short={short} url={job.url} />
                </div>
                
                <div className="pt-2">
                   {short.renderStatus === 'rendering' ? (
                     <button disabled className="w-full py-3 bg-indigo-50 text-indigo-500 font-bold rounded-xl flex items-center justify-center gap-2 border-2 border-indigo-100">
                       <Loader2 className="animate-spin" /> Renderowanie... {short.renderProgress !== undefined ? `${short.renderProgress}%` : ''}
                     </button>
                   ) : short.renderStatus === 'finished' && short.finalVideoUrl ? (
                     <a href={short.finalVideoUrl} download target="_blank" rel="noreferrer" className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-500/20">
                       <Download size={20} /> POBIERZ GOTOWY SZORT
                     </a>
                   ) : (
                     <button onClick={() => renderVideo(job, i)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20">
                       <Video size={20} /> Generuj Plik Wideo
                     </button>
                   )}
                </div>
              </div>
            )
          })}
        </div>
      )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
