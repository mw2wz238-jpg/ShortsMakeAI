import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../AuthContext';
import { db } from '../firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Video, Loader2, Settings2, Scissors, Sparkles, Languages } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { JobSettings } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { useTranslation } from 'react-i18next';

export default function NewExtraction() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [url, setUrl] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !url) return;
    setIsSubmitting(true);
    
    const jobId = crypto.randomUUID();
    const now = Date.now();
    
    try {
      await setDoc(doc(db, 'jobs', jobId), {
        userId: user.uid,
        url,
        status: 'pending',
        settings,
        createdAt: now,
        updatedAt: now,
      });

      toast.loading(t('extracting'), { id: jobId });

      const response = await fetch('/api/functions/extract-shorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: url, settings: settings })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || t('extraction_failed'));
      }

      const { transcriptText } = await response.json();

      const platformMap: Record<string, string> = {
        tiktok: 'TikTok (fast-paced, highly engaging hooks)',
        youtube_shorts: 'YouTube Shorts (attention-grabbing, algorithmic focus)',
        reels: 'Instagram Reels (aesthetic, relatable or educational)'
      };

      const durationMap: Record<string, string> = {
        under_60s: 'Maximum 60 seconds per segment',
        under_30s: 'Maximum 30 seconds per segment',
        any: 'Any suitable length'
      };

      const focusMap: Record<string, string> = {
        humor: 'funny moments, jokes, and reactions',
        educational: 'insightful explanations, tutorials, and facts',
        engaging_hook: 'strong opening hooks, controversies, and story peaks',
        any: 'the generally best moments'
      };

      const outLang = settings.outputLanguage || 'en';

      const prompt = `Identify the 3 most engaging segments of this video optimized for ${platformMap[settings.targetPlatform as keyof typeof platformMap] || platformMap.tiktok}. 
Focus primarily on finding ${focusMap[settings.focus as keyof typeof focusMap] || focusMap.engaging_hook}. 
Constraint: ${durationMap[settings.durationLimit as keyof typeof durationMap] || durationMap.under_60s}.
Provide exact start/end timestamps (in seconds) and justify why they are engaging. 
CRITICAL: The generated \`title\` and \`description\` properties in the JSON response MUST be written in the following language: ${outLang}.

UNIQUE REQUIREMENT: You are also the "Viral Architect" and "Precision Editor". For each segment, you must provide:
1. viralScore: A score from 0-100 indicating viral potential.
2. newHookScript: A punchy 3-second script (written in ${outLang}) that the user can dub over the beginning of the video replacing the original intro to maximize retention.
3. retentionHacks: An array of 3 specific editing instructions (e.g. ['Add zoom', 'Split screen with Subway Surfers']) to keep Gen Z attention.
4. crop_x_center: A number from 0.0 to 1.0 indicating the horizontal center of the crop for 9:16 format (e.g., 0.5 is perfectly centered).
5. zoom_points: A timeline of zoom effects. Array of { time, scale } where time is the timestamp relative to the original video and scale is the zoom factor (1.0 is default).
6. captions: A highly detailed array of { start, end, text } containing precise timestamps for each word or phrase spoken in the segment. Create at least 3-4 captions minimum if there is speech.

A transcript constraint:
${transcriptText ? transcriptText.substring(0, 30000) : "No transcript available. Please analyze the video's content natively using the provided URL."}

Url: ${url}`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let aiResponse;
      try {
        aiResponse = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: "You are an expert video editor and social media manager. You have access to YouTube videos if the user provides a link. Return pure JSON array of segments.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                start: { type: Type.NUMBER },
                end: { type: Type.NUMBER },
                description: { type: Type.STRING },
                viralScore: { type: Type.NUMBER },
                newHookScript: { type: Type.STRING },
                retentionHacks: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                crop_x_center: { type: Type.NUMBER },
                zoom_points: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      time: { type: Type.NUMBER },
                      scale: { type: Type.NUMBER }
                    },
                    required: ["time", "scale"]
                  }
                },
                captions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      start: { type: Type.NUMBER },
                      end: { type: Type.NUMBER },
                      text: { type: Type.STRING }
                    },
                    required: ["start", "end", "text"]
                  }
                }
              },
              required: ["title", "start", "end", "description", "viralScore", "newHookScript", "retentionHacks", "crop_x_center", "zoom_points", "captions"]
            }
          }
        }
      });
      } catch (genAiError) {
        throw new Error(genAiError instanceof Error ? genAiError.message : String(genAiError));
      }
      
      const shortsText = aiResponse.text || "[]";
      let shorts;
      try {
        shorts = JSON.parse(shortsText);
      } catch (e) {
        throw new Error("Failed to parse AI response. " + shortsText);
      }

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
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Sparkles className="text-indigo-600" /> {t('new_ext_title')}
        </h1>
        <p className="text-slate-500 mt-2">{t('new_ext_subtitle')}</p>
      </div>

      <div className="bg-white border text-left border-slate-200 shadow-sm rounded-3xl p-6 md:p-10 space-y-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-900">{t('url_label')}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Video className="text-slate-400" size={20} />
              </div>
              <input
                type="url"
                required
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="block w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/50 transition-all text-base"
              />
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Settings2 size={16} /> {t('ai_directives_label')}
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
              disabled={isSubmitting || !url}
              className={cn(
                "w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-lg font-semibold transition-all shadow-sm",
                isSubmitting || !url 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md hover:scale-[1.01]"
              )}
            >
              {isSubmitting ? (
                <><Loader2 className="animate-spin" /> {t('extracting')}</>
              ) : (
                <><Scissors /> {t('extract_button')}</>
              )}
            </button>
            <p className="text-center text-xs text-slate-400 mt-4">
              {t('extract_note')}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
