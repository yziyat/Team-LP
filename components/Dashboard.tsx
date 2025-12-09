
import React, { useState } from 'react';
import { Users, UserCheck, UserX, BarChart as BarChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Employee, PlanningData, AppSettings } from '../types';
import { TRANSLATIONS } from '../constants';
import { Modal } from './ui/Modal';

interface DashboardProps {
  employees: Employee[];
  planning: PlanningData;
  lang: AppSettings['language'];
}

export const Dashboard: React.FC<DashboardProps> = ({ employees, planning, lang }) => {
  const t = TRANSLATIONS[lang];
  const today = new Date().toISOString().split('T')[0];

  const [modalType, setModalType] = useState<'present' | 'absent' | null>(null);
  
  // Calculate Stats
  const activeEmployees = employees.filter(e => !e.exitDate);
  
  const getEmployeeStatus = (empId: number) => {
    return planning[`${empId}_${today}`];
  };

  const presentEmployees = activeEmployees.filter(emp => {
    const shift = getEmployeeStatus(emp.id);
    return shift && shift !== 'Repos' && shift !== 'Absent' && shift !== 'Congé' && shift !== 'Maladie' && shift !== 'Formation' && shift !== 'Récupération';
  });
  
  const absentEmployees = activeEmployees.filter(emp => {
     const shift = getEmployeeStatus(emp.id);
     return !shift || shift === 'Repos' || shift === 'Absent' || shift === 'Congé' || shift === 'Maladie' || shift === 'Formation' || shift === 'Récupération';
  });

  const presentCount = presentEmployees.length;
  const absentCount = absentEmployees.length;

  // Category Distribution
  const categoryCounts = activeEmployees.reduce((acc, emp) => {
    acc[emp.category] = (acc[emp.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  
  const StatCard = ({ title, value, icon: Icon, colorClass, bgClass, onClick }: any) => (
    <div 
      className={`bg-white p-6 rounded-xl border border-gray-100 shadow-sm transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-1' : ''}`}
      onClick={onClick}
    >
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
          onClick={() => setModalType('present')} 
        />
        <StatCard 
          title={t.stats_absent} 
          value={absentCount} 
          icon={UserX} 
          colorClass="text-orange-600" 
          bgClass="bg-orange-50"
          onClick={() => setModalType('absent')} 
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

      {/* Detail Modal */}
      <Modal
        isOpen={!!modalType}
        onClose={() => setModalType(null)}
        title={modalType === 'present' ? t.stats_present : t.stats_absent}
      >
        <div className="space-y-4">
           {modalType && (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">{lang === 'fr' ? 'Employé' : 'Employee'}</th>
                            <th className="px-4 py-3">{lang === 'fr' ? 'Statut / Shift' : 'Status / Shift'}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {(modalType === 'present' ? presentEmployees : absentEmployees).length === 0 && (
                            <tr>
                                <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                                    {lang === 'fr' ? 'Aucun résultat' : 'No results'}
                                </td>
                            </tr>
                        )}
                        {(modalType === 'present' ? presentEmployees : absentEmployees).map(emp => {
                            const status = getEmployeeStatus(emp.id);
                            return (
                                <tr key={emp.id} className="bg-white hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</div>
                                        <div className="text-xs text-gray-500">{emp.matricule}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${modalType === 'present' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {status || (lang === 'fr' ? 'Non défini' : 'Undefined')}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                 </table>
              </div>
           )}
           <div className="text-right text-xs text-gray-400">
              {new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
           </div>
        </div>
      </Modal>
    </div>
  );
};
