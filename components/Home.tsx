
import React from 'react';
import { Calendar, Users, Settings, LayoutDashboard, UserPlus, ShieldCheck, Award, GraduationCap } from 'lucide-react';
import { TabName, AppSettings, User } from '../types';
import { TRANSLATIONS } from '../constants';

interface HomeProps {
  setTab: (tab: TabName) => void;
  lang: AppSettings['language'];
  currentUser: User;
}

const QuickCard = ({ title, icon: Icon, onClick, colorClass }: { title: string, icon: any, onClick: () => void, colorClass: string }) => (
  <button 
    onClick={onClick}
    className={`bg-white p-4 md:p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group flex flex-col items-center justify-center gap-4 md:gap-6 h-32 md:h-48`}
  >
    <div className={`p-3 md:p-5 rounded-2xl border-2 transition-all duration-300 group-hover:scale-110 ${colorClass}`}>
      <Icon size={28} className="md:w-10 md:h-10 stroke-[1.5]" />
    </div>
    <span className="font-bold text-slate-600 text-[10px] md:text-sm text-center leading-tight uppercase tracking-[0.1em]">{title}</span>
  </button>
);

export const Home: React.FC<HomeProps> = ({ setTab, lang, currentUser }) => {
  const t = TRANSLATIONS[lang];
  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="space-y-10 animate-in fade-in duration-500 py-4">
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{t.welcome_title}</h2>
        <p className="text-slate-500 text-sm md:text-lg font-medium">{t.welcome_subtitle}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        <QuickCard 
          title={t.dashboard}
          icon={LayoutDashboard}
          onClick={() => setTab('dashboard')}
          colorClass="border-indigo-100 text-indigo-500 group-hover:bg-indigo-50 group-hover:border-indigo-200"
        />
        <QuickCard 
          title={t.planning}
          icon={Calendar}
          onClick={() => setTab('planning')}
          colorClass="border-purple-100 text-purple-500 group-hover:bg-purple-50 group-hover:border-purple-200"
        />
        <QuickCard 
          title={t.employees}
          icon={Users}
          onClick={() => setTab('employees')}
          colorClass="border-blue-100 text-blue-500 group-hover:bg-blue-50 group-hover:border-blue-200"
        />
        <QuickCard 
          title={t.training}
          icon={GraduationCap}
          onClick={() => setTab('training')}
          colorClass="border-teal-100 text-teal-500 group-hover:bg-teal-50 group-hover:border-teal-200"
        />
        <QuickCard 
          title={t.bonus}
          icon={Award}
          onClick={() => setTab('bonus')}
          colorClass="border-pink-100 text-pink-500 group-hover:bg-pink-50 group-hover:border-pink-200"
        />
        <QuickCard 
          title={t.settings}
          icon={Settings}
          onClick={() => setTab('settings')}
          colorClass="border-orange-100 text-orange-500 group-hover:bg-orange-50 group-hover:border-orange-200"
        />
        
        {/* Admin Only Cards */}
        {isAdmin && (
          <>
            <QuickCard 
              title={t.users}
              icon={UserPlus}
              onClick={() => setTab('users')}
              colorClass="border-emerald-100 text-emerald-500 group-hover:bg-emerald-50 group-hover:border-emerald-200"
            />
            <QuickCard 
              title={t.audit}
              icon={ShieldCheck}
              onClick={() => setTab('audit')}
              colorClass="border-slate-200 text-slate-600 group-hover:bg-slate-50 group-hover:border-slate-300"
            />
          </>
        )}
      </div>
    </div>
  );
};
