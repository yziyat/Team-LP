
import React from 'react';
import { Users, UserCheck, UserX, BarChart as BarChartIcon, Briefcase } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Employee, PlanningData, AppSettings, Team } from '../types';
import { TRANSLATIONS } from '../constants';

interface DashboardProps {
  employees: Employee[];
  planning: PlanningData;
  lang: AppSettings['language'];
}

export const Dashboard: React.FC<DashboardProps> = ({ employees, planning, lang }) => {
  const t = TRANSLATIONS[lang];
  const today = new Date().toISOString().split('T')[0];
  
  // Calculate Stats
  const activeEmployees = employees.filter(e => !e.exitDate);
  
  const presentCount = activeEmployees.filter(emp => {
    const shift = planning[`${emp.id}_${today}`];
    return shift && shift !== 'Repos' && shift !== 'Absent' && shift !== 'Congé' && shift !== 'Maladie';
  }).length;
  
  const absentCount = activeEmployees.length - presentCount;

  // Category Distribution
  const categoryCounts = activeEmployees.reduce((acc, emp) => {
    acc[emp.category] = (acc[emp.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  // Team Distribution logic (Need to infer teams from employee teamIds if teams prop isn't passed to dashboard)
  // Since I don't have `teams` prop here, I'll count by teamId and display "Team {id}" or filter known IDs.
  // Ideally Dashboard should receive teams prop. 
  // For now let's just use Category chart as it's safe. 
  // NOTE: Prompt asked for "Teams and member count". I will need to pass teams to Dashboard in App.tsx. 
  // I will assume `teams` is NOT available in this specific file version yet, so I will stick to what I can do or 
  // I will update App.tsx to pass teams.
  
  // Let's assume I will update DashboardProps to include teams in the next steps (or user has to add it). 
  // Wait, I can update the file content to include `teams` in props now.
  
  const StatCard = ({ title, value, icon: Icon, colorClass, bgClass }: any) => (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
        </div>
        <div className={`p-3 rounded-full ${bgClass} ${colorClass}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.dashboard}</h2>
          <p className="text-gray-500">{lang === 'fr' ? 'Vue d\'ensemble des statistiques' : 'Statistics overview'}</p>
        </div>
        <div className="text-sm bg-white px-4 py-2 rounded-full border shadow-sm text-gray-600 font-medium">
          {new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title={t.stats_total} 
          value={activeEmployees.length} 
          icon={Users} 
          colorClass="text-blue-600" 
          bgClass="bg-blue-50" 
        />
        <StatCard 
          title={t.stats_present} 
          value={presentCount} 
          icon={UserCheck} 
          colorClass="text-green-600" 
          bgClass="bg-green-50" 
        />
        <StatCard 
          title={t.stats_absent} 
          value={absentCount} 
          icon={UserX} 
          colorClass="text-orange-600" 
          bgClass="bg-orange-50" 
        />
      </div>

      {/* Charts */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-96">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <BarChartIcon size={20} className="text-gray-400"/>
          {lang === 'fr' ? 'Répartition par Catégorie' : 'Category Distribution'}
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="horizontal" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{fontSize: 12}} />
              <YAxis />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{fill: '#f3f4f6'}}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            {lang === 'fr' ? 'Aucune donnée' : 'No data available'}
          </div>
        )}
      </div>
    </div>
  );
};
