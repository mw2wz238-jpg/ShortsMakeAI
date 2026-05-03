import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { cn } from '../lib/utils';

export default function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className={cn("relative group", className)}>
      <button className="flex items-center gap-2 bg-white/50 hover:bg-white border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 transition-all">
        <Globe size={16} />
        {i18n.language.toUpperCase().substring(0, 2)}
      </button>
      <div className="absolute right-0 mt-2 w-32 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="p-1">
          <button onClick={() => changeLanguage('pl')} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-slate-50", i18n.language.startsWith('pl') ? "font-bold text-indigo-600 bg-indigo-50/50" : "text-slate-700")}>Polski</button>
          <button onClick={() => changeLanguage('en')} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-slate-50", i18n.language.startsWith('en') ? "font-bold text-indigo-600 bg-indigo-50/50" : "text-slate-700")}>English</button>
          <button onClick={() => changeLanguage('es')} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-slate-50", i18n.language.startsWith('es') ? "font-bold text-indigo-600 bg-indigo-50/50" : "text-slate-700")}>Español</button>
          <button onClick={() => changeLanguage('de')} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-slate-50", i18n.language.startsWith('de') ? "font-bold text-indigo-600 bg-indigo-50/50" : "text-slate-700")}>Deutsch</button>
        </div>
      </div>
    </div>
  );
}
