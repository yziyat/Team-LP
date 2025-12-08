
import React, { useState, useEffect } from 'react';
import { Clock, X, RotateCcw, UserX } from 'lucide-react';
import { Employee, AppSettings, PlanningData, Team, User } from '../types';
import { Modal } from './ui/Modal';
import { TRANSLATIONS } from '../constants';
import { Button } from './ui/Button';

interface PlanningProps {
  employees: Employee[];
  teams: Team[];
  settings: AppSettings;
  planning: PlanningData;
  currentUser: User;
  onUpdatePlanning: (empId: number, date: string, shift: string | null) => void;
}

export const Planning: React.FC<PlanningProps> = ({ employees, teams, settings, planning, currentUser, onUpdatePlanning }) => {
  const t = TRANSLATIONS[settings.language];
  
  // Date State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Start of week (Mon)
    return d.toISOString().split('T')[0];
  });
  const [daysToShow, setDaysToShow] = useState(7);
  const [selectedCell, setSelectedCell] = useState<{empId: number, date: string} | null>(null);
  
  // Filter State
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  // Determine which team the current user leads (if any)
  const managedTeam = teams.find(t => t.leaderId === currentUser.employeeId);
  const isManager = currentUser.role === 'manager' && !!managedTeam;

  // Effect to auto-filter for managers
  useEffect(() => {
    if (isManager && managedTeam) {
      setTeamFilter(String(managedTeam.id));
    }
  }, [isManager, managedTeam]);

  // Generate Date Range
  const dates = [];
  const current = new Date(startDate);
  for (let i = 0; i < daysToShow; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Filter Employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.firstName.toLowerCase().includes(employeeSearch.toLowerCase()) || 
      emp.lastName.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.matricule.toLowerCase().includes(employeeSearch.toLowerCase());
    
    // If manager, FORCE team filter. Else use selected filter.
    const effectiveTeamFilter = isManager && managedTeam ? String(managedTeam.id) : teamFilter;
    const matchesTeam = effectiveTeamFilter ? emp.teamId?.toString() === effectiveTeamFilter : true;
    
    // Hide exited employees in planning unless searching? Or simpler: hide all exited.
    // Let's hide exited employees to keep planning clean
    const isActive = !emp.exitDate;

    return matchesSearch && matchesTeam && isActive;
  });

  const handleResetFilters = () => {
    setEmployeeSearch('');
    if (!isManager) setTeamFilter('');
  };

  const handleShiftSelect = (shiftName: string | null) => {
    if (selectedCell) {
      onUpdatePlanning(selectedCell.empId, selectedCell.date, shiftName);
      setSelectedCell(null);
    }
  };

  const getShiftDetails = (name: string) => settings.shifts.find(s => s.name === name);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.planning}</h2>
          <p className="text-gray-500">{settings.language === 'fr' ? 'Gestion des shifts' : 'Shift management'}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
          {/* Team Filter - Disabled for Managers */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            disabled={isManager}
            className={`border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-500 bg-white ${isManager ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
          >
            <option value="">{t.filter_team}</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>

          {/* Search Dropdown/Input */}
          <input 
            type="text"
            placeholder={t.filter_employee}
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-500"
          />

          {!isManager && (
            <button 
              onClick={handleResetFilters}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title={t.reset}
            >
              <RotateCcw size={16} />
            </button>
          )}

          <div className="h-6 w-px bg-gray-200 hidden md:block mx-1"></div>

          {/* Date Controls */}
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none"
          />
          <select 
            value={daysToShow} 
            onChange={(e) => setDaysToShow(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none bg-white"
          >
            <option value={7}>7 {settings.language === 'fr' ? 'Jours' : 'Days'}</option>
            <option value={14}>14 {settings.language === 'fr' ? 'Jours' : 'Days'}</option>
            <option value={30}>30 {settings.language === 'fr' ? 'Jours' : 'Days'}</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[500px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 border-r border-b border-gray-200 min-w-[200px] p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                  {settings.language === 'fr' ? 'Employé' : 'Employee'}
                </th>
                {dates.map(date => {
                  const dateStr = date.toISOString().split('T')[0];
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const holiday = settings.holidays.find(h => h.date === dateStr);
                  
                  return (
                    <th key={dateStr} className={`min-w-[80px] p-2 text-center border-b border-gray-200 border-r border-gray-100 last:border-r-0 ${holiday ? 'bg-red-50' : isWeekend ? 'bg-slate-50' : 'bg-white'}`}>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">
                            {date.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' })}
                        </span>
                        <span className={`text-lg font-bold ${holiday ? 'text-red-600' : 'text-gray-800'}`}>{date.getDate()}</span>
                        <span className={`text-xs font-medium uppercase ${holiday ? 'text-red-500' : 'text-gray-500'}`}>
                          {date.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' })}
                        </span>
                        {holiday && (
                          <span className="text-[10px] text-red-500 font-medium truncate max-w-full px-1" title={holiday.name}>{holiday.name}</span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50/30">
                  <td className="sticky left-0 z-10 bg-white border-r border-b border-gray-200 p-3 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                    <div className="font-medium text-sm text-gray-900">{emp.firstName} {emp.lastName}</div>
                    <div className="text-xs text-gray-500 font-mono">{emp.matricule}</div>
                  </td>
                  {dates.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const shiftName = planning[`${emp.id}_${dateStr}`];
                    const shiftDetails = shiftName ? getShiftDetails(shiftName) : null;
                    const holiday = settings.holidays.find(h => h.date === dateStr);
                    
                    const shiftColor = shiftDetails?.color || '#3b82f6';
                    // Check if it's an absence type (no shift details)
                    const isAbsence = shiftName && !shiftDetails && settings.absenceTypes.includes(shiftName);
                    
                    let bgStyle = {};
                    if (shiftName) {
                        if (shiftDetails) {
                             bgStyle = { backgroundColor: `${shiftColor}20`, color: shiftColor, borderColor: `${shiftColor}40` };
                        } else if (isAbsence) {
                             bgStyle = { backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }; // Redish for absence
                        } else {
                            // Fallback
                             bgStyle = { backgroundColor: '#f3f4f6', color: '#4b5563' };
                        }
                    }

                    return (
                      <td 
                        key={dateStr} 
                        onClick={() => setSelectedCell({ empId: emp.id, date: dateStr })}
                        className={`border-b border-r border-gray-100 last:border-r-0 p-1 cursor-pointer transition-colors hover:bg-gray-100 relative h-16 ${holiday ? 'bg-red-50/30' : isWeekend ? 'bg-slate-50/50' : ''}`}
                      >
                        {shiftName && (
                          <div 
                            className="w-full h-full rounded flex flex-col items-center justify-center p-1 text-xs border shadow-sm transition-all"
                            style={bgStyle}
                          >
                            <span className="font-bold truncate w-full text-center">{shiftName}</span>
                            {shiftDetails && (
                              <span className="text-[10px] opacity-75">{shiftDetails.start}-{shiftDetails.end}</span>
                            )}
                          </div>
                        )}
                        {/* Auto-fill holiday text if empty? Optional, but users might want to override holidays */}
                        {!shiftName && holiday && (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-[10px] text-red-300 transform -rotate-45 select-none">Férié</span>
                            </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={dates.length + 1} className="p-12 text-center text-gray-400">
                    {settings.language === 'fr' ? 'Aucun employé trouvé.' : 'No employees found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shift Selection Modal */}
      <Modal 
        isOpen={!!selectedCell} 
        onClose={() => setSelectedCell(null)} 
        title={settings.language === 'fr' ? 'Assigner un shift' : 'Assign shift'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 text-center">
            {selectedCell && new Date(selectedCell.date).toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-1">
            <button 
              onClick={() => handleShiftSelect(null)}
              className="w-full p-3 rounded-lg border border-red-100 bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <X size={16} />
              {settings.language === 'fr' ? 'Effacer' : 'Clear'}
            </button>
            
            {/* Shifts */}
            <div className="text-xs font-semibold text-gray-500 uppercase mt-2 mb-1">Shifts</div>
            {settings.shifts.map(shift => (
              <button
                key={shift.name}
                onClick={() => handleShiftSelect(shift.name)}
                className="w-full p-3 rounded-lg border border-gray-200 hover:shadow-md transition-all text-left group bg-white"
                style={{ borderLeftWidth: '4px', borderLeftColor: shift.color || '#3b82f6' }}
              >
                <div className="font-semibold text-gray-800">{shift.name}</div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} />
                  {shift.start} - {shift.end}
                </div>
              </button>
            ))}

            {/* Absence Types */}
            {settings.absenceTypes.length > 0 && (
                <>
                <div className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-1">Absences</div>
                <div className="grid grid-cols-2 gap-2">
                    {settings.absenceTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => handleShiftSelect(type)}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <UserX size={14} className="text-gray-400" />
                            {type}
                        </button>
                    ))}
                </div>
                </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};