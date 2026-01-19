
import React, { useState, useMemo } from 'react';
import { Users, UserCheck, UserX, BarChart as BarChartIcon, Calendar, Briefcase, Clock, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Employee, PlanningData, AppSettings, Team } from '../types';
import { TRANSLATIONS } from '../constants';
import { Modal } from './ui/Modal';

interface DashboardProps {
  employees: Employee[];
  teams: Team[];
  planning: PlanningData;
  lang: AppSettings['language'];
  settings: AppSettings;
}

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

export const Dashboard: React.FC<DashboardProps> = ({ employees, teams, planning, lang, settings }) => {
  const t = TRANSLATIONS[lang];
  
  // State for the selected date (default to today)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modal State: storing the title and list of employees to show
  const [modalData, setModalData] = useState<{ title: string; list: Employee[] } | null>(null);
  
  // Active Employees (not exited)
  const activeEmployees = useMemo(() => {
    return employees.filter(e => !e.exitDate);
  }, [employees]);
  
  const getEmployeeStatus = (empId: number) => {
    return planning[`${empId}_${selectedDate}`];
  };

  // Centralized Holiday Check
  const holidayToday = useMemo(() => {
    return settings.holidays.find(h => {
        if (h.type === 'civil') {
            return h.date.slice(5) === selectedDate.slice(5);
        }
        return h.date === selectedDate;
    });
  }, [settings.holidays, selectedDate]);

  // 1. GLOBAL COUNTS
  const presentEmployees = activeEmployees.filter(emp => {
    const shift = getEmployeeStatus(emp.id);
    const isAbsent = settings.absenceTypes.some(a => a.name === shift) || shift === 'Repos';
    // If it's a holiday and no specific shift is assigned, they are not "Present"
    return shift && !isAbsent;
  });
  
  const absentEmployees = activeEmployees.filter(emp => {
     const shift = getEmployeeStatus(emp.id);
     const isAbsent = settings.absenceTypes.some(a => a.name === shift) || shift === 'Repos';
     return !shift || isAbsent;
  });

  // 2. SHIFT & ABSENCE DISTRIBUTION (Clickable)
  const shiftCounts: Record<string, Employee[]> = {};
  
  activeEmployees.forEach(emp => {
      const status = getEmployeeStatus(emp.id);
      if (status) {
          if (!shiftCounts[status]) shiftCounts[status] = [];
          shiftCounts[status].push(emp);
      }
  });

  const shiftsConfig = settings.shifts;
  const absenceConfig = settings.absenceTypes;

  // 3. CHARTS DATA
  const categoryCounts = activeEmployees.reduce((acc, emp) => {
    acc[emp.category] = (acc[emp.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const categoryChartData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

  const assignmentCounts = activeEmployees.reduce((acc, emp) => {
      const assign = emp.assignment || 'Unassigned';
      acc[assign] = (acc[assign] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);
  const assignmentChartData = Object.entries(assignmentCounts).map(([name, value]) => ({ name, value }));

  // 4. TEAM RECAP DATA
  const teamStats = teams.map(team => {
      const members = employees.filter(e => e.teamId === team.id && !e.exitDate);
      const total = members.length;
      
      const shiftsDistribution: Record<string, number> = {};
      settings.shifts.forEach(s => shiftsDistribution[s.name] = 0);
      let othersCount = 0;

      members.forEach(m => {
          const shiftName = getEmployeeStatus(m.id);
          if (shiftName && shiftsDistribution.hasOwnProperty(shiftName)) {
              shiftsDistribution[shiftName]++;
          } else {
              othersCount++; 
          }
      });

      return {
          id: team.id,
          name: team.name,
          total,
          shiftsDistribution,
          othersCount,
          members 
      };
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

  const openListModal = (title: string, list: Employee[]) => {
      setModalData({ title, list });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* HEADER & DATE PICKER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-800">{t.dashboard}</h2>
            {holidayToday && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full animate-pulse border border-red-200">
                {holidayToday.name}
              </span>
            )}
          </div>
          <p className="text-gray-500">{lang === 'fr' ? 'Vue d\'ensemble et statistiques' : 'Overview and statistics'}</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Calendar size={20} />
            </div>
            <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    {lang === 'fr' ? 'Date sélectionnée' : 'Selected Date'}
                </label>
                <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-sm font-semibold text-gray-800 outline-none bg-transparent cursor-pointer"
                />
            </div>
        </div>
      </div>

      {/* TOP STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title={t.stats_total} 
          value={activeEmployees.length} 
          icon={Users} 
          colorClass="text-blue-600" 
          bgClass="bg-blue-50" 
          onClick={() => openListModal(t.stats_total, activeEmployees)}
        />
        <StatCard 
          title={t.stats_present} 
          value={presentEmployees.length} 
          icon={UserCheck} 
          colorClass="text-green-600" 
          bgClass="bg-green-50"
          onClick={() => openListModal(t.stats_present, presentEmployees)}
        />
        <StatCard 
          title={t.stats_absent} 
          value={absentEmployees.length} 
          icon={UserX} 
          colorClass="text-orange-600" 
          bgClass="bg-orange-50"
          onClick={() => openListModal(t.stats_absent, absentEmployees)}
        />
      </div>

      {/* SHIFT & ABSENCE BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
             <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center gap-2">
                 <Clock size={16} className="text-blue-500" />
                 {lang === 'fr' ? 'Shifts de travail' : 'Working Shifts'}
             </h3>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                 {shiftsConfig.map(shift => {
                     const list = shiftCounts[shift.name] || [];
                     return (
                         <div 
                            key={shift.name} 
                            onClick={() => openListModal(shift.name, list)}
                            className="bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-lg p-3 cursor-pointer transition-all group"
                         >
                             <div className="flex justify-between items-center mb-1">
                                 <span className="text-xs font-semibold text-gray-600 group-hover:text-blue-700">{shift.name}</span>
                                 <div className="w-2 h-2 rounded-full" style={{backgroundColor: shift.color}}></div>
                             </div>
                             <div className="text-2xl font-bold text-gray-800 group-hover:text-blue-700">{list.length}</div>
                         </div>
                     )
                 })}
             </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
             <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center gap-2">
                 <UserX size={16} className="text-orange-500" />
                 {lang === 'fr' ? 'Absences & Repos' : 'Absences & Rest'}
             </h3>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                 {absenceConfig.map(abs => {
                     const list = shiftCounts[abs.name] || [];
                     return (
                         <div 
                            key={abs.name} 
                            onClick={() => openListModal(abs.name, list)}
                            className="bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-lg p-3 cursor-pointer transition-all group"
                         >
                             <div className="flex justify-between items-center mb-1">
                                 <span className="text-xs font-semibold text-gray-600 group-hover:text-orange-700">{abs.name}</span>
                                 <div className="w-2 h-2 rounded-full" style={{backgroundColor: abs.color}}></div>
                             </div>
                             <div className="text-2xl font-bold text-gray-800 group-hover:text-orange-700">{list.length}</div>
                         </div>
                     )
                 })}
             </div>
          </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col">
                <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center gap-2">
                    <Briefcase size={16} className="text-gray-500"/>
                    {lang === 'fr' ? 'Par Catégorie' : 'By Category'}
                </h3>
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" allowDecimals={false} hide />
                            <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11}} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{fill: '#f3f4f6'}} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                {categoryChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

             <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col">
                <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center gap-2">
                    <MapPin size={16} className="text-gray-500"/>
                    {lang === 'fr' ? 'Par Affectation' : 'By Assignment'}
                </h3>
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={assignmentChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {assignmentChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
      </div>

      {/* TEAM OVERVIEW TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
             <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Users size={20} className="text-blue-600"/>
                    {lang === 'fr' ? 'Détails par Équipe' : 'Team Details'}
                </h3>
             </div>
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                     <thead className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
                         <tr>
                             <th className="px-6 py-4">{lang === 'fr' ? 'Équipe' : 'Team'}</th>
                             <th className="px-4 py-4 text-center border-l border-gray-200 bg-gray-100/50">{lang === 'fr' ? 'Total' : 'Total'}</th>
                             {settings.shifts.map(s => (
                                 <th key={s.name} className="px-4 py-4 text-center text-blue-600 border-l border-gray-100">
                                     {s.name}
                                 </th>
                             ))}
                             <th className="px-4 py-4 text-center text-orange-500 border-l border-gray-100">
                                 {lang === 'fr' ? 'Autres' : 'Others'}
                             </th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100 text-sm">
                         {teamStats.map(stat => {
                            const getShiftMembers = (shiftName: string) => stat.members.filter(m => getEmployeeStatus(m.id) === shiftName);
                            const getOtherMembers = () => stat.members.filter(m => {
                                const st = getEmployeeStatus(m.id);
                                return !st || !settings.shifts.some(s => s.name === st);
                            });

                            return (
                             <tr key={stat.id} className="hover:bg-gray-50 transition-colors group">
                                 <td className="px-6 py-4 font-medium text-gray-800">{stat.name}</td>
                                 <td 
                                    className="px-4 py-4 text-center font-bold text-gray-900 border-l border-gray-100 bg-gray-50/50 cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                    onClick={() => openListModal(`${stat.name} - Total`, stat.members)}
                                 >
                                    {stat.total}
                                 </td>
                                 {settings.shifts.map(s => {
                                     const count = stat.shiftsDistribution[s.name];
                                     return (
                                         <td 
                                            key={s.name} 
                                            className={`px-4 py-4 text-center font-medium text-gray-600 border-l border-gray-100 ${count > 0 ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-600 hover:font-bold' : 'opacity-50'}`}
                                            onClick={() => {
                                                if (count > 0) openListModal(`${stat.name} - ${s.name}`, getShiftMembers(s.name));
                                            }}
                                         >
                                             {count || '-'}
                                         </td>
                                     );
                                 })}
                                 <td 
                                    className={`px-4 py-4 text-center font-medium text-orange-500 border-l border-gray-100 bg-orange-50/10 ${stat.othersCount > 0 ? 'cursor-pointer hover:bg-orange-100 hover:font-bold' : 'opacity-50'}`}
                                    onClick={() => {
                                        if (stat.othersCount > 0) openListModal(`${stat.name} - Others`, getOtherMembers());
                                    }}
                                 >
                                     {stat.othersCount || '-'}
                                 </td>
                             </tr>
                            );
                         })}
                         {teamStats.length === 0 && (
                             <tr>
                                 <td colSpan={settings.shifts.length + 3} className="px-6 py-8 text-center text-gray-400 italic">
                                     {lang === 'fr' ? 'Aucune équipe configurée' : 'No teams configured'}
                                 </td>
                             </tr>
                         )}
                     </tbody>
                 </table>
             </div>
        </div>

      {/* DETAIL MODAL */}
      <Modal
        isOpen={!!modalData}
        onClose={() => setModalData(null)}
        title={modalData?.title || ''}
      >
        <div className="space-y-4">
           {modalData && (
              <>
                <div className="flex justify-between items-center text-sm text-gray-500 mb-2">
                     <span>{modalData.list.length} {lang === 'fr' ? 'Employés' : 'Employees'}</span>
                     <span className="font-medium text-blue-600">{selectedDate}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-gray-200 max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3">{lang === 'fr' ? 'Nom' : 'Name'}</th>
                                <th className="px-4 py-3 hidden sm:table-cell">{lang === 'fr' ? 'Matricule' : 'ID'}</th>
                                <th className="px-4 py-3">{lang === 'fr' ? 'Équipe' : 'Team'}</th>
                                <th className="px-4 py-3">{lang === 'fr' ? 'Statut' : 'Status'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {modalData.list.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                                        {lang === 'fr' ? 'Aucun résultat' : 'No results'}
                                    </td>
                                </tr>
                            )}
                            {modalData.list.map(emp => {
                                const team = teams.find(t => t.id === emp.teamId);
                                const status = getEmployeeStatus(emp.id);
                                return (
                                    <tr key={emp.id} className="bg-white hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {emp.firstName} {emp.lastName}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden sm:table-cell">
                                            {emp.matricule}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {team ? team.name : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            <span className={`px-2 py-1 rounded font-medium ${status ? 'bg-gray-100 text-gray-700' : 'bg-red-50 text-red-600'}`}>
                                                {status || (lang === 'fr' ? 'Non assigné' : 'Unassigned')}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
              </>
           )}
        </div>
      </Modal>
    </div>
  );
};
