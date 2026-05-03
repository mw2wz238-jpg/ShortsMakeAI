import React from 'react';
import { LogIn, Scissors, ChevronRight, Play, Zap, ArrowRight, Video } from 'lucide-react';
import { signIn } from '../firebase';
import { motion } from 'motion/react';
import { useTranslation, Trans } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Landing() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden relative">
      {/* Decorative background blurs */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none" />
      <div className="absolute top-1/4 -left-64 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-64 w-[600px] h-[600px] bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />

      <header className="relative max-w-6xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-sm">
            <Scissors size={24} />
          </div>
          <span className="font-bold text-2xl tracking-tight text-slate-900">{t('app_name')}</span>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <button 
            onClick={signIn}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 shadow-sm px-5 py-2.5 rounded-xl font-semibold text-slate-700 transition-all hover:shadow"
          >
            {t('sign_in')}
            <ArrowRight size={18} />
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-32 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-4xl mx-auto space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-sm border border-indigo-100 mb-4">
            <Zap size={16} className="fill-indigo-600" /> {t('powered_by')}
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            <Trans i18nKey="landing_title">
              Turn massive videos into <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">viral shorts.</span>
            </Trans>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            {t('landing_subtitle')}
          </p>
          
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={signIn}
              className="w-full sm:w-auto flex flex-col items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2 text-lg">
                <LogIn size={20} /> {t('get_started')}
              </div>
            </button>
            <a 
              href="#how-it-works"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-8 py-4 rounded-2xl font-bold transition-all shadow-sm"
            >
              <Play size={20} className="fill-current" /> {t('watch_demo')}
            </a>
          </div>
        </motion.div>

        {/* Feature grid */}
        <motion.div 
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
           className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 text-left"
        >
           <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <Video size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">{t('feature_1_title')}</h3>
              <p className="text-slate-500 leading-relaxed">{t('feature_1_desc')}</p>
           </div>
           
           <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <Scissors size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">{t('feature_2_title')}</h3>
              <p className="text-slate-500 leading-relaxed">{t('feature_2_desc')}</p>
           </div>
           
           <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900">{t('feature_3_title')}</h3>
              <p className="text-slate-500 leading-relaxed">{t('feature_3_desc')}</p>
           </div>
        </motion.div>
      </main>
    </div>
  );
}
