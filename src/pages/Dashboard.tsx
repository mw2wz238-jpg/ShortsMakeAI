import React, { useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AuthContext } from '../AuthContext';
import { Job } from '../types';
import { Clock, Video, CheckCircle, BarChart3, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, hoursSaved: 0 });
  const { t } = useTranslation();

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'jobs'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parsedJobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Job[];
      setJobs(parsedJobs);
      
      const comp = parsedJobs.filter(j => j.status === 'completed').length;
      // Mocking 1.5 hours saved per video
      setStats({
        total: parsedJobs.length,
        completed: comp,
        hoursSaved: Math.round(comp * 1.5 * 10) / 10
      });

    }, (error) => handleFirestoreError(error, OperationType.LIST, 'jobs'));

    return unsubscribe;
  }, [user]);

  const StatCard = ({ title, value, icon: Icon, colorClass, gradient }: any) => (
    <div className={cn("p-6 rounded-3xl border bg-white shadow-sm flex items-start gap-4 relative overflow-hidden", gradient)}>
      <div className={cn("p-3 rounded-2xl", colorClass)}>
        <Icon size={24} strokeWidth={2} />
      </div>
      <div>
        <p className="text-slate-500 font-medium tracking-tight mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('overview_title')}</h1>
        <p className="text-slate-500 mt-2">{t('overview_subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title={t('stat_processed')}
          value={stats.total} 
          icon={Video} 
          colorClass="bg-blue-100 text-blue-700" 
        />
        <StatCard 
          title={t('stat_shorts')}
          value={stats.completed * 3} // Roughly 3 per complete job
          icon={CheckCircle} 
          colorClass="bg-indigo-100 text-indigo-700" 
        />
        <StatCard 
          title={t('stat_hours')}
          value={`${stats.hoursSaved}h`} 
          icon={Clock} 
          colorClass="bg-emerald-100 text-emerald-700" 
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="text-indigo-600" size={20} />
            {t('recent_activity')}
          </h2>
          <Link to="/library" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center">
            {t('view_all')} <ChevronRight size={16} />
          </Link>
        </div>
        
        {jobs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p>{t('no_activity')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {jobs.slice(0, 5).map(job => (
              <div key={job.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center border",
                    job.status === 'completed' ? "bg-green-50 border-green-200 text-green-600" :
                    job.status === 'error' ? "bg-red-50 border-red-200 text-red-600" :
                    "bg-amber-50 border-amber-200 text-amber-600"
                  )}>
                    {job.status === 'completed' ? <CheckCircle size={20} /> : <Video size={20} />}
                  </div>
                  <div>
                     <a href={job.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-900 hover:underline line-clamp-1 break-all flex-1 max-w-sm">
                       {job.url}
                     </a>
                     <p className="text-xs text-slate-500 mt-1">
                       {formatDistanceToNow(job.createdAt, { addSuffix: true })}
                     </p>
                  </div>
                </div>
                <div>
                   <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
                      job.status === 'completed' ? "bg-green-100 text-green-700" :
                      job.status === 'error' ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700 animate-pulse"
                   )}>
                     {job.status}
                   </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
