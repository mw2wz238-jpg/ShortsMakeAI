import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { db, signIn, signOut, handleFirestoreError, OperationType } from './firebase';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, orderBy } from 'firebase/firestore';
import { LogIn, LogOut, Video, Scissors, FileVideo2, Play, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';

interface Short {
  title: string;
  start: number;
  end: number;
  description: string;
}

interface Job {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  shorts?: Short[];
  error?: string;
  createdAt: number;
  updatedAt: number;
  userId: string;
}

export default function App() {
  const { user, loading } = useContext(AuthContext);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!user) {
      setJobs([]);
      return;
    }

    const q = query(
      collection(db, 'jobs'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parsedJobs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Job[];
      setJobs(parsedJobs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
    });

    return unsubscribe;
  }, [user]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !videoUrl) return;
    setSubmitError('');
    setIsSubmitting(true);

    const jobId = crypto.randomUUID();
    const now = Date.now();
    const jobData = {
      userId: user.uid,
      url: videoUrl,
      status: 'pending' as const,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Set the job in Firestore as pending
      await setDoc(doc(db, 'jobs', jobId), jobData);
      setVideoUrl('');

      // Trigger the backend API to get transcript
      const response = await fetch('/api/functions/get-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to fetch video transcript.');
      }

      const { transcriptText } = await response.json();

      const prompt = `Identify the 3 most engaging segments of this video for a TikTok audience. 
Provide start/end timestamps (in seconds) and justify why they are engaging. 
A transcript constraint:
${transcriptText ? transcriptText.substring(0, 30000) : "No transcript available. You must analyze the visual content."}

Url: ${videoUrl}`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: "You have access to YouTube videos if the user provides a link. Return pure JSON array of segments.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                start: { type: Type.NUMBER },
                end: { type: Type.NUMBER },
                description: { type: Type.STRING }
              },
              required: ["title", "start", "end", "description"]
            }
          }
        }
      });

      const shortsText = aiResponse.text || "[]";
      let shorts;
      try {
        shorts = JSON.parse(shortsText);
      } catch (e) {
        throw new Error("Failed to parse AI response into valid shorts format.");
      }

      await updateDoc(doc(db, 'jobs', jobId), {
        status: 'completed',
        shorts,
        updatedAt: Date.now()
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setSubmitError(errorMessage);
      
      try {
        await updateDoc(doc(db, 'jobs', jobId), {
          status: 'error',
          error: errorMessage,
          updatedAt: Date.now()
        });
      } catch (fbErr) {
        console.error("Failed to update firestore with error state:", fbErr);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 max-w-sm">
          <div className="mx-auto bg-blue-100 text-blue-600 rounded-full w-20 h-20 flex items-center justify-center">
            <Scissors size={40} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">AutoShorts SaaS</h1>
          <p className="text-gray-500">Automagically cut engaging shorts from any YouTube video using Gemini AI.</p>
          <button 
            onClick={signIn}
            className="flex items-center justify-center gap-2 w-full bg-black text-white hover:bg-gray-800 transition-colors py-3 rounded-lg font-medium"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg">
            <Scissors size={20} />
          </div>
          <h1 className="font-bold text-lg hidden sm:block tracking-tight text-gray-900">AutoShorts</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {user.photoURL && <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-gray-200" />}
            <span className="text-sm font-medium text-gray-600 hidden md:block">{user.email}</span>
          </div>
          <button onClick={signOut} className="text-gray-500 hover:text-black p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:p-12 space-y-12">
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-10 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">New Extraction</h2>
            <p className="text-gray-500 mt-1">Paste a YouTube URL to automatically find the most engaging segments.</p>
          </div>
          
          <form onSubmit={handleCreateJob} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Video className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="url" 
                required
                placeholder="https://youtu.be/..."
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base"
              />
            </div>
            <button 
              disabled={isSubmitting || !videoUrl}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Scissors size={20} />}
              Cut Shorts
            </button>
          </form>
          {submitError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm font-medium">
              <AlertCircle size={18} /> {submitError}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight px-2">Your Extractions</h2>
          
          {jobs.length === 0 ? (
            <div className="text-center py-24 text-gray-400 bg-gray-100/50 rounded-2xl border border-gray-200 border-dashed">
              <FileVideo2 size={48} className="mx-auto mb-4 opacity-50" />
              <p>No video extractions yet. Let's create your first short!</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {jobs.map(job => (
                <div key={job.id} className="bg-white border text-left border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <a href={job.url} target="_blank" rel="noreferrer" className="text-blue-600 font-medium hover:underline flex items-center gap-2 break-all">
                        {job.url}
                      </a>
                      <p className="text-xs text-gray-400 mt-2 font-mono">
                         {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wider
                        ${job.status === 'completed' ? 'bg-green-100 text-green-700' : 
                          job.status === 'error' ? 'bg-red-100 text-red-700' : 
                          'bg-blue-100 text-blue-700 animate-pulse'
                        }
                      `}>
                        {job.status}
                      </span>
                    </div>
                  </div>

                  {job.status === 'error' && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-100">
                       <strong className="block mb-1">Processing Failed</strong>
                       {job.error}
                    </div>
                  )}

                  {job.status === 'completed' && job.shorts && (
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      <h3 className="font-semibold text-gray-900 border-b pb-2">Extracted Segments</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {job.shorts.map((short, i) => (
                          <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-3 group hover:border-blue-300 transition-colors">
                            <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-blue-600 transition-colors">{short.title}</h4>
                            <p className="text-xs text-gray-500 leading-relaxed flex-1 line-clamp-3">
                              {short.description}
                            </p>
                            <div className="mt-auto pt-3 flex items-center justify-between border-t border-gray-200/50">
                              <span className="text-xs font-mono font-medium text-gray-600 bg-white px-2 py-1 rounded shadow-sm border border-gray-200">
                                {formatDuration(short.start)} - {formatDuration(short.end)}
                              </span>
                              <a 
                                href={`${job.url}&t=${Math.floor(short.start)}s`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors flex items-center"
                              >
                                <Play size={16} className="fill-current"/>
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
