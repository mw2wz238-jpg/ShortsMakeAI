import React, { useState, useContext, useEffect, useCallback } from 'react';
import { AuthContext } from '../AuthContext';
import { db, storage } from '../firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import { Video, Loader2, Settings2, Scissors, Sparkles, Languages, UploadCloud } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { JobSettings } from '../types';
import { useTranslation } from 'react-i18next';

export default function NewExtraction() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [settings, setSettings] = useState<JobSettings>({
    targetPlatform: 'tiktok',
    durationLimit: 'under_60s',
    focus: 'engaging_hook',
    outputLanguage: i18n.language
  });

  useEffect(() => {
    setSettings(s => ({ ...s, outputLanguage: i18n.language }));
  }, [i18n.language]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    maxFiles: 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file) return;
    setIsSubmitting(true);
    
    const jobId = crypto.randomUUID();
    const now = Date.now();
    
    try {
      // 1. First, upload to Firebase Storage
      const storageRef = ref(storage, `raw_videos/${user.uid}/${jobId}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          }, 
          (error) => reject(error), 
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });
      
      // 2. Initialize Firestore Job
      await setDoc(doc(db, 'jobs', jobId), {
        userId: user.uid,
        url: downloadUrl, // Using the Storage url
        fileName: file.name,
        status: 'pending',
        settings,
        createdAt: now,
        updatedAt: now,
      });

      toast.loading(t('extracting', 'Analiza wideo przez AI...'), { id: jobId });

      // 3. Call Backend for AI Analysis
      const response = await fetch('/api/functions/extract-shorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: downloadUrl, fileName: file.name, settings })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || t('extraction_failed'));
      }

      const { shorts } = await response.json();

      await updateDoc(doc(db, 'jobs', jobId), {
        status: 'completed',
        shorts,
        updatedAt: Date.now()
      });
      
      toast.success('Ready!', { id: jobId });
      navigate('/library');

    } catch (err) {
      console.error(err);
      toast.error(t('extraction_failed') + ': ' + (err instanceof Error ? err.message : String(err)), { id: jobId });
      await updateDoc(doc(db, 'jobs', jobId), {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        updatedAt: Date.now()
      }).catch(console.error);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Sparkles className="text-indigo-600" /> Profesjonalny Edytor Wideo
        </h1>
        <p className="text-slate-500 mt-2">Wgraj swój plik z dysku, a AI automatycznie wykadruje i potnie materiał.</p>
      </div>

      <div className="bg-white border text-left border-slate-200 shadow-sm rounded-3xl p-6 md:p-10 space-y-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-900">Wgraj Plik Wideo</label>
            
            <div 
              {...getRootProps()} 
              className={cn(
                "border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer",
                isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-slate-400 bg-slate-50"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <UploadCloud size={48} className={isDragActive ? "text-indigo-600" : "text-slate-400"} />
                {file ? (
                  <div className="text-sm font-semibold text-slate-900">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</div>
                ) : (
                  <div>
                    <div className="text-base font-medium text-slate-900">Przeciągnij i upuść plik wideo tutaj</div>
                    <div className="text-sm text-slate-500">lub kliknij, żeby przeglądać dysk (MP4, MOV)</div>
                  </div>
                )}
              </div>
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
               <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-4">
                 <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
               </div>
            )}
          </div>

          <div className="space-y-6 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Settings2 size={16} /> {t('ai_directives_label', 'Wytyczne Edycji AI')}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('target_platform')}</label>
                <select 
                  value={settings.targetPlatform}
                  onChange={e => setSettings({...settings, targetPlatform: e.target.value as any})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600/50 font-medium text-slate-700"
                >
                  <option value="tiktok">{t('plat_tiktok')}</option>
                  <option value="youtube_shorts">{t('plat_shorts')}</option>
                  <option value="reels">{t('plat_reels')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('focus_area')}</label>
                <select 
                  value={settings.focus}
                  onChange={e => setSettings({...settings, focus: e.target.value as any})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600/50 font-medium text-slate-700"
                >
                  <option value="engaging_hook">{t('focus_hook')}</option>
                  <option value="humor">{t('focus_humor')}</option>
                  <option value="educational">{t('focus_edu')}</option>
                  <option value="any">{t('focus_any')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('duration_target')}</label>
                <select 
                  value={settings.durationLimit}
                  onChange={e => setSettings({...settings, durationLimit: e.target.value as any})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600/50 font-medium text-slate-700"
                >
                  <option value="under_60s">{t('dur_60s')}</option>
                  <option value="under_30s">{t('dur_30s')}</option>
                  <option value="any">{t('dur_any')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Languages size={14}/> {t('output_language')}</label>
                <select 
                  value={settings.outputLanguage || 'en'}
                  onChange={e => setSettings({...settings, outputLanguage: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-600/50 font-medium text-slate-700"
                >
                  <option value="pl">Polski</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={isSubmitting || !file}
              className={cn(
                "w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-lg font-semibold transition-all shadow-sm",
                isSubmitting || !file 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md hover:scale-[1.01]"
              )}
            >
              {isSubmitting ? (
                <><Loader2 className="animate-spin" /> {uploadProgress > 0 && uploadProgress < 100 ? `Wysyłanie pliku... ${uploadProgress.toFixed(0)}%` : t('extracting', 'Analiza pliku...')}</>
              ) : (
                <><Scissors /> Rozpocznij montaż AI</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
