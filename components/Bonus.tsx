
import React, { useState } from 'react';
import { AppSettings, Bonus as BonusType, Employee, Team } from '../types';
import { TRANSLATIONS } from '../constants';
import { Filter, Award, Search, History } from 'lucide-react';

interface BonusProps {
  employees: Employee[];
  teams: Team[];
  bonuses: BonusType[];
  settings: AppSettings;
  onUpdateBonus: (empId: number, month: string, amount: number) => void;
}

export const Bonus: React.FC<BonusProps> = ({ employees, teams, bonuses, settings, onUpdateBonus }) => {
  const t = TRANSLATIONS[settings.language];
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchTerm, setSearchTerm] = useState('');
  
  // History Filters
  const [historyStartMonth, setHistoryStartMonth] = useState('');
  const [historyEndMonth, setHistoryEndMonth] = useState('');
  const [historyPersonFilter, setHistoryPersonFilter] = useState('');

  // Main Input Logic
  const eligibleEmployees = employees.filter(emp => {
    const inTeam = selectedTeam ? emp.teamId?.toString() === selectedTeam : false;
    // Also filter by search term for the input table
    const matchesSearch = 
        emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.matricule.toLowerCase().includes(searchTerm.toLowerCase());
    
    return inTeam && emp.isBonusEligible && matchesSearch && !emp.exitDate;
  });

  const getBonusAmount = (empId: number, month: string) => {
    const bonus = bonuses.find(b => b.employeeId === empId && b.month === month);
    return bonus ? bonus.amount : '';
  };

  const handleScoreChange = (empId: number, value: string) => {
    const numValue = value === '' ? 0 : Number(value);
    if (!isNaN(numValue)) {
      onUpdateBonus(empId, selectedMonth, numValue);
    }
  };

  // PIVOT TABLE LOGIC FOR HISTORY
  // 1. Get unique months based on existing bonuses AND optional filters
  let uniqueMonths = Array.from(new Set(bonuses.map(b => b.month))).sort().reverse();
  
  if (historyStartMonth || historyEndMonth) {
      uniqueMonths = uniqueMonths.filter(m => {
          if (historyStartMonth && m < historyStartMonth) return false;
          if (historyEndMonth && m > historyEndMonth) return false;
          return true;
      });
  }

  // 2. Get unique employees who have bonuses
  // If we filter by person, reduce this list
  const employeesWithBonuses = employees.filter(emp => {
      const hasBonus = bonuses.some(b => b.employeeId === emp.id);
      const matchesName = historyPersonFilter 
        ? (emp.firstName.toLowerCase().includes(historyPersonFilter.toLowerCase()) || 
           emp.lastName.toLowerCase().includes(historyPersonFilter.toLowerCase()))
        : true;
      return hasBonus && matchesName;
  });


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.bonus}</h2>
          <p className="text-gray-500">{t.bonus_management}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* INPUT SECTION */}
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                <Award size={20} className="text-blue-600"/> Input Scores
            </h3>
            
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                 <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Team</label>
                        <select
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeam(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                        >
                        <option value="">{t.select_team}</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                        </select>
                    </div>
                    <div>
                         <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Month</label>
                         <input 
                            type="month" 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none"
                        />
                    </div>
                 </div>
                 <div>
                     <input 
                        type="text" 
                        placeholder={t.filter_name_code}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                 </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                {selectedTeam ? (
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white shadow-sm z-10">
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4 w-32 text-right">{t.score}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {eligibleEmployees.length > 0 ? (
                        eligibleEmployees.map(emp => (
                            <tr key={emp.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</div>
                                <div className="text-xs text-gray-500">{emp.matricule}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <input 
                                    type="number" 
                                    min="0"
                                    placeholder="0"
                                    className="w-24 pl-2 pr-2 py-1 border rounded text-right focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none"
                                    value={getBonusAmount(emp.id, selectedMonth)}
                                    onChange={(e) => handleScoreChange(emp.id, e.target.value)}
                                />
                            </td>
                            </tr>
                        ))
                        ) : (
                        <tr>
                            <td colSpan={2} className="px-6 py-12 text-center text-gray-400">
                            No eligible employees found.
                            </td>
                        </tr>
                        )}
                    </tbody>
                    </table>
                </div>
                ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                    <Award size={48} className="opacity-30 text-blue-500 mb-2" />
                    <p>{t.select_team}</p>
                </div>
                )}
            </div>
        </div>

        {/* HISTORY SECTION (Pivot Table) */}
        <div className="space-y-4">
             <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                <History size={20} className="text-purple-600"/> {t.history}
            </h3>
            
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3">
                 <div className="flex-1">
                     <input 
                        type="text" 
                        placeholder="Filter by person..."
                        value={historyPersonFilter}
                        onChange={(e) => setHistoryPersonFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none"
                    />
                 </div>
                 <div className="flex items-center gap-2">
                    <input 
                        type="month" 
                        value={historyStartMonth}
                        onChange={(e) => setHistoryStartMonth(e.target.value)}
                        className="w-32 px-2 py-2 text-sm rounded-lg border border-gray-200"
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                        type="month" 
                        value={historyEndMonth}
                        onChange={(e) => setHistoryEndMonth(e.target.value)}
                        className="w-32 px-2 py-2 text-sm rounded-lg border border-gray-200"
                    />
                 </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white shadow-sm z-10">
                            <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <th className="px-4 py-3 sticky left-0 bg-gray-50 z-20 border-r border-gray-200">Employee</th>
                                {uniqueMonths.map(month => (
                                    <th key={month} className="px-4 py-3 text-center min-w-[80px] border-r border-gray-100 last:border-0">{month}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employeesWithBonuses.length > 0 ? (
                                employeesWithBonuses.map(emp => (
                                    <tr key={emp.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3 sticky left-0 bg-white border-r border-gray-200 font-medium text-sm text-gray-900">
                                            {emp.firstName} {emp.lastName}
                                        </td>
                                        {uniqueMonths.map(month => {
                                            const amount = getBonusAmount(emp.id, month);
                                            return (
                                                <td key={month} className="px-4 py-3 text-center text-sm border-r border-gray-100 last:border-0">
                                                    {amount ? <span className="font-bold text-green-600">{amount}</span> : '-'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={uniqueMonths.length + 1} className="px-6 py-12 text-center text-gray-400">
                                        No history found matching filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};