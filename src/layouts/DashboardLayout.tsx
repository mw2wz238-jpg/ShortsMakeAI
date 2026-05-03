import React, { useContext } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Scissors, Library, Settings, LogOut, FileVideo2 } from 'lucide-react';
import { AuthContext } from '../AuthContext';
import { signOut } from '../firebase';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function DashboardLayout() {
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();

  const navItems = [
    { label: t('menu_overview'), icon: LayoutDashboard, to: '/' },
    { label: t('menu_new'), icon: Scissors, to: '/new' },
    { label: t('menu_library'), icon: Library, to: '/library' },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-sm">
              <FileVideo2 size={24} />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">{t('app_name')}</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-indigo-50 text-indigo-700 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon size={18} strokeWidth={2.5} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-200 space-y-4">
          <LanguageSwitcher className="w-full" />
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-slate-200 shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col whitespace-nowrap overflow-hidden">
              <span className="text-sm font-semibold text-slate-900 truncate">Pro Account</span>
              <span className="text-xs text-slate-500 truncate">{user.email}</span>
            </div>
          </div>
          <button 
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors w-full rounded-xl hover:bg-red-50"
          >
            <LogOut size={18} />
            {t('sign_out')}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <FileVideo2 size={20} />
            </div>
            <span className="font-bold text-lg text-slate-900">{t('app_name')}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button onClick={signOut} className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-lg">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
