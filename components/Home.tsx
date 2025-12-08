import React from 'react';
import { Calendar, Users, Settings, Activity, LayoutDashboard, UserPlus, ShieldCheck } from 'lucide-react';
import { TabName, AppSettings } from '../types';
import { TRANSLATIONS } from '../constants';

interface HomeProps {
  setTab: (tab: TabName) => void;
  lang: AppSettings['language'];
}

export const Home: React.FC<HomeProps> = ({ setTab, lang }) => {
  const t = TRANSLATIONS[lang];

  const QuickCard = ({ title, icon: Icon, tab, color }: { title: string, icon: any, tab: TabName, color: string }) => (
    <button 
      onClick={() => setTab(tab)}
      className={`bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group flex flex-col items-center justify-center gap-4 h-40`}
    >
      <div className={`p-4 rounded-full ${color} text-white shadow-md group-hover:scale-110 transition-transform`}>
        <Icon size={32} />
      </div>
      <span className="font-semibold text-gray-700 text-lg">{title}</span>
    </button>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center md:text-left">
        <h2 className="text-3xl font-bold text-gray-900">{t.welcome_title}</h2>
        <p className="text-gray-500 mt-2 text-lg">{t.welcome_subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <QuickCard 
          title={t.dashboard}
          icon={LayoutDashboard}
          tab="dashboard"
          color="bg-indigo-500"
        />
        <QuickCard 
          title={t.planning}
          icon={Calendar}
          tab="planning"
          color="bg-purple-500"
        />
        <QuickCard 
          title={t.employees}
          icon={Users}
          tab="employees"
          color="bg-blue-500"
        />
        <QuickCard 
          title={t.settings}
          icon={Settings}
          tab="settings"
          color="bg-orange-500"
        />
         <QuickCard 
          title={t.users}
          icon={UserPlus}
          tab="users"
          color="bg-emerald-500"
        />
         <QuickCard 
          title={t.audit}
          icon={ShieldCheck}
          tab="audit"
          color="bg-slate-600"
        />
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-2xl border border-blue-100">
        <div className="flex items-start gap-4">
          <Activity className="text-blue-600 mt-1" size={24} />
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">{t.recent_activity}</h3>
            <p className="text-gray-600">
              {lang === 'fr' 
                ? "Le système est prêt. Commencez par ajouter des collaborateurs ou configurer vos équipes." 
                : "The system is ready. Start by adding employees or configuring your teams."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};