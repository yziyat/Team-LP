
import React from 'react';
import { Calendar, Users, Settings, Activity, LayoutDashboard, UserPlus, ShieldCheck, Award, GraduationCap } from 'lucide-react';
import { TabName, AppSettings } from '../types';
import { TRANSLATIONS } from '../constants';

interface HomeProps {
  setTab: (tab: TabName) => void;
  lang: AppSettings['language'];
}

const QuickCard = ({ title, icon: Icon, onClick, color }: { title: string, icon: any, onClick: () => void, color: string }) => (
  <button 
    onClick={onClick}
    className={`bg-white p-3 md:p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group flex flex-col items-center justify-center gap-2 md:gap-4 h-28 md:h-40`}
  >
    <div className={`p-2 md:p-4 rounded-full ${color} text-white shadow-md group-hover:scale-110 transition-transform`}>
      <Icon size={24} className="md:w-8 md:h-8" />
    </div>
    <span className="font-semibold text-gray-700 text-xs md:text-lg text-center leading-tight">{title}</span>
  </button>
);

export const Home: React.FC<HomeProps> = ({ setTab, lang }) => {
  const t = TRANSLATIONS[lang];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center md:text-left">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{t.welcome_title}</h2>
        <p className="text-gray-500 mt-2 text-sm md:text-lg">{t.welcome_subtitle}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <QuickCard 
          title={t.dashboard}
          icon={LayoutDashboard}
          onClick={() => setTab('dashboard')}
          color="bg-indigo-500"
        />
        <QuickCard 
          title={t.planning}
          icon={Calendar}
          onClick={() => setTab('planning')}
          color="bg-purple-500"
        />
        <QuickCard 
          title={t.employees}
          icon={Users}
          onClick={() => setTab('employees')}
          color="bg-blue-500"
        />
        <QuickCard 
          title={t.training}
          icon={GraduationCap}
          onClick={() => setTab('training')}
          color="bg-teal-500"
        />
        <QuickCard 
          title={t.bonus}
          icon={Award}
          onClick={() => setTab('bonus')}
          color="bg-pink-500"
        />
        <QuickCard 
          title={t.settings}
          icon={Settings}
          onClick={() => setTab('settings')}
          color="bg-orange-500"
        />
         <QuickCard 
          title={t.users}
          icon={UserPlus}
          onClick={() => setTab('users')}
          color="bg-emerald-500"
        />
         <QuickCard 
          title={t.audit}
          icon={ShieldCheck}
          onClick={() => setTab('audit')}
          color="bg-slate-600"
        />
      </div>
    </div>
  );
};
