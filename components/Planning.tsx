
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, RotateCcw, UserX, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Download, Grid, CalendarDays, FileText, Image as ImageIcon, Filter as FilterIcon, ChevronDown, Trash2, Zap, Coffee } from 'lucide-react';
import { Employee, AppSettings, PlanningData, Team, User } from '../types';
import { Modal } from './ui/Modal';
import { TRANSLATIONS } from '../constants';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PlanningProps {
  employees: Employee[];
  teams: Team[];
  settings: AppSettings;
  planning: PlanningData;
  currentUser: User;
  onUpdatePlanning: (employeeId: number, dateStr: string, shiftName: string | null) => void;
}

const toLocalISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const Planning: React.FC<PlanningProps> = ({ employees, teams, settings, planning, currentUser, onUpdatePlanning }) => {
  const t = TRANSLATIONS[settings.language];
  const printRef = useRef<HTMLDivElement>(null);
  
  const [mobileView, setMobileView] = useState<'calendar' | 'grid'>('grid');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return toLocalISO(d);
  });
  const [daysToShow, setDaysToShow] = useState(14);
  const [selectedCell, setSelectedCell] = useState<{empId: number, date: string} | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [mobileMonth, setMobileMonth] = useState(new Date());
  const [mobileSelectedEmpId, setMobileSelectedEmpId] = useState<number | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const managedTeam = teams.find(t => t.leaderId === currentUser.employeeId);
  const isManager = currentUser.role === 'manager' && !!managedTeam;

  useEffect(() => {
    if (isManager && managedTeam) setTeamFilter(String(managedTeam.id));
  }, [isManager, managedTeam]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = 
        emp.firstName.toLowerCase().includes(employeeSearch.toLowerCase()) || 
        emp.lastName.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        emp.matricule.toLowerCase().includes(employeeSearch.toLowerCase());
      const effectiveTeamFilter = isManager && managedTeam ? String(managedTeam.id) : teamFilter;
      const matchesTeam = effectiveTeamFilter ? emp.teamId?.toString() === effectiveTeamFilter : true;
      return matchesSearch && matchesTeam && !emp.exitDate;
    }).sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [employees, employeeSearch, teamFilter, isManager, managedTeam]);

  const handleShiftSelect = (shiftName: string | null) => {
    if (selectedCell) {
      onUpdatePlanning(selectedCell.empId, selectedCell.date, shiftName);
      setSelectedCell(null);
    }
  };

  const changeDate = (days: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    setStartDate(toLocalISO(d));
  };

  const changeMobileMonth = (delta: number) => {
    const d = new Date(mobileMonth);
    d.setMonth(d.getMonth() + delta);
    setMobileMonth(d);
  };

  const getShiftDetails = (name: string) => settings.shifts.find(s => s.name === name);
  const getAbsenceDetails = (name: string) => settings.absenceTypes.find(a => a.name === name);

  const dates: Date[] = [];
  const current = new Date(startDate);
  for (let i = 0; i < daysToShow; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const formatDisplayDateLocal = (dateStr: string, format: string) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return format === 'DD/MM/YYYY' ? `${day}/${month}/${year}` : `${year}-${month}-${day}`;
  };

  const handleExport = async (type: 'pdf' | 'image') => {
    setIsExportMenuOpen(false);
    const filename = `planning_${new Date().toISOString().slice(0, 10)}`;
    const teamName = teamFilter ? teams.find(t => String(t.id) === teamFilter)?.name : (settings.language === 'fr' ? 'Toutes les équipes' : 'All Teams');
    
    try {
      if (type === 'pdf') {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        
        const drawHeader = () => {
          doc.setFontSize(16);
          doc.setTextColor(31, 41, 55);
          doc.text("PLANNING PERSONNEL", 14, 15);
          doc.setFontSize(9);
          doc.setTextColor(107, 114, 128);
          const periodText = `${settings.language === 'fr' ? 'Période' : 'Period'}: ${formatDisplayDateLocal(startDate, settings.dateFormat)} - ${formatDisplayDateLocal(toLocalISO(dates[dates.length-1]), settings.dateFormat)}`;
          doc.text(periodText, 14, 22);
          doc.text(`Team: ${teamName} | User: ${currentUser.name}`, 14, 27);
        };

        const head = [[
          settings.language === 'fr' ? 'Employé' : 'Employee', 
          ...dates.map(d => d.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }))
        ]];
        
        const body = filteredEmployees.map(emp => [
          `${emp.firstName} ${emp.lastName}`,
          ...dates.map(date => planning[`${emp.id}_${toLocalISO(date)}`] || '-')
        ]);

        autoTable(doc, {
          head,
          body,
          startY: 32,
          styles: { 
            fontSize: 7, 
            cellPadding: 2.5, 
            halign: 'center', 
            valign: 'middle',
            minCellHeight: 10, 
            lineWidth: 0.1,
            lineColor: [229, 231, 235]
          },
          columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 45 } },
          headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index > 0) {
              const val = data.cell.raw as string;
              if (val && val !== '-') {
                const details = getShiftDetails(val) || getAbsenceDetails(val);
                if (details) {
                  const hex = details.color.replace('#', '');
                  data.cell.styles.fillColor = [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
                  data.cell.styles.textColor = [255, 255, 255];
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            }
          },
          didDrawPage: (data) => {
            drawHeader();
            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Page ${data.pageNumber}`, pageSize.width - 25, pageHeight - 10);
            doc.text(`Team LP - Generated on ${new Date().toLocaleDateString()}`, 14, pageHeight - 10);
          }
        });
        doc.save(`${filename}.pdf`);
      } else {
        const target = printRef.current;
        if (!target) return;
        const canvas = await html2canvas(target, { scale: 2, useCORS: true, logging: false });
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const isHoliday = (dateStr: string) => {
    return settings.holidays.find(h => {
        if (h.type === 'civil') {
            // Compare only Month and Day (MM-DD)
            return h.date.slice(5) === dateStr.slice(5);
        }
        // Compare full date for Religious/Variable
        return h.date === dateStr;
    });
  };

  const renderCellContent = (empId: number, dateStr: string, isSmall = false) => {
     const shiftName = planning[`${empId}_${dateStr}`];
     const shiftDetails = shiftName ? getShiftDetails(shiftName) : null;
     const absenceDetails = shiftName ? getAbsenceDetails(shiftName) : null;
     const holiday = isHoliday(dateStr);
     const bgColor = shiftDetails ? shiftDetails.color : absenceDetails ? absenceDetails.color : '#9ca3af';
     
     if (shiftName) {
        return (
             <div className="w-full h-full rounded flex items-center justify-center p-0.5 border shadow-sm" 
                  style={{ backgroundColor: `${bgColor}20`, color: bgColor, borderColor: `${bgColor}40` }}>
                 <span className={`${isSmall ? 'text-[7px]' : 'text-[9px]'} font-black truncate`}>{shiftName.substring(0, 3)}</span>
             </div>
        );
     } else if (holiday) {
        return (
             <div className="w-full h-full flex items-center justify-center opacity-30">
                 <span className={`${isSmall ? 'text-[6px]' : 'text-[8px]'} text-red-500 font-bold uppercase`} title={holiday.name}>Férié</span>
             </div>
        );
     }
     return null;
  };

  const formatModalDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const mobileCalendarDays = useMemo(() => {
    const year = mobileMonth.getFullYear();
    const month = mobileMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; 
    for(let i=0; i<startOffset; i++) days.push(null);
    for(let i=1; i<=lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  }, [mobileMonth]);

  const selectedEmployee = useMemo(() => {
    return selectedCell ? employees.find(e => e.id === selectedCell.empId) : null;
  }, [selectedCell, employees]);

  return (
    <div className="space-y-4 h-full flex flex-col bg-[#f8fafc]">
      {/* MOBILE HEADER */}
      <div className="md:hidden flex bg-[#eef2ff] p-1 rounded-xl w-full">
          <button onClick={() => setMobileView('calendar')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mobileView === 'calendar' ? 'bg-white text-[#3b82f6] shadow-sm' : 'text-[#64748b]'}`}>
            <CalendarDays size={18} /> {t.view_calendar}
          </button>
          <button onClick={() => setMobileView('grid')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mobileView === 'grid' ? 'bg-[#3b82f6] text-white shadow-sm' : 'text-[#64748b]'}`}>
            <Grid size={18} /> {t.view_grid}
          </button>
      </div>

      {/* FILTERS BAR */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 min-w-[140px] flex-1">
          <FilterIcon size={16} className="text-gray-400" />
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} disabled={isManager} className="w-full bg-transparent border-none text-xs font-bold text-gray-700 focus:ring-0 appearance-none truncate">
            <option value="">{t.filter_team}</option>
            {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </div>
        <div className="w-px h-6 bg-gray-100 hidden md:block" />
        <input type="text" placeholder={t.search} value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} className="bg-transparent border-none text-xs font-bold text-gray-700 focus:ring-0 flex-1 min-w-[100px]" />
        
        <div className="w-px h-6 bg-gray-100 hidden md:block" />
        <div className="flex items-center gap-1">
          <button onClick={() => changeDate(-daysToShow)} className="p-1 hover:bg-gray-100 rounded transition-colors"><ChevronLeft size={20} /></button>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black text-gray-700 focus:ring-0 w-28" />
          <button onClick={() => changeDate(daysToShow)} className="p-1 hover:bg-gray-100 rounded transition-colors"><ChevronRight size={20} /></button>
        </div>
        
        <div className="w-px h-6 bg-gray-100 hidden md:block" />
        <div className="relative group">
            <select value={daysToShow} onChange={(e) => setDaysToShow(Number(e.target.value))} className="bg-transparent border-none text-xs font-bold text-gray-700 focus:ring-0 appearance-none pr-6">
                <option value={7}>7 jrs</option>
                <option value={14}>14 jrs</option>
                <option value={30}>30 jrs</option>
            </select>
            <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button onClick={() => handleExport('pdf')} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors ml-auto shadow-sm" title={t.export_pdf}><Download size={18} /></button>
      </div>

      {/* MOBILE GRID VIEW */}
      {mobileView === 'grid' && (
        <div className="md:hidden flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="overflow-auto flex-1 touch-auto scrollbar-hide" ref={printRef}>
            <table className="w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-40 bg-white shadow-sm">
                <tr>
                  <th className="sticky left-0 z-50 bg-white border-r border-b border-gray-100 p-3 text-left text-[10px] font-black text-gray-400 uppercase min-w-[110px] h-12">Employé</th>
                  {dates.map((date) => {
                    const dateStr = toLocalISO(date);
                    const holiday = isHoliday(dateStr);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <th key={dateStr} className={`border-b border-r border-gray-50 p-1 text-center min-w-[44px] ${holiday ? 'bg-red-50' : isWeekend ? 'bg-gray-50' : 'bg-white'}`}>
                        <div className="flex flex-col items-center leading-none">
                          <span className={`text-[11px] font-black ${holiday ? 'text-red-600' : 'text-[#64748b]'}`}>{date.getDate()}</span>
                          <span className={`text-[8px] font-bold mt-0.5 uppercase ${holiday ? 'text-red-400' : 'text-gray-300'}`}>{date.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' })[0]}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 z-30 bg-white border-r border-b border-gray-50 p-2 h-12 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                      <div className="font-bold text-[9px] text-gray-800 truncate uppercase">{emp.firstName} {emp.lastName}</div>
                      <div className="text-[7px] text-gray-400 font-mono leading-none tracking-tight">{emp.matricule}</div>
                    </td>
                    {dates.map((date) => {
                      const dateStr = toLocalISO(date);
                      return (
                        <td key={dateStr} onClick={() => setSelectedCell({ empId: emp.id, date: dateStr })} className="border-r border-b border-gray-50 p-0.5 cursor-pointer h-12 min-w-[44px]">
                          {renderCellContent(emp.id, dateStr)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DESKTOP TABLE */}
      <div className="hidden md:block flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
        <div className="overflow-auto h-full touch-auto" ref={printRef}>
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-40 bg-gray-50/95 backdrop-blur-sm shadow-sm">
              <tr>
                <th className="sticky left-0 z-50 bg-gray-50 border-r border-b border-gray-200 p-4 text-left text-[11px] font-black text-gray-400 uppercase min-w-[160px] h-14">Employé</th>
                {dates.map((date) => {
                  const dateStr = toLocalISO(date);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const holiday = isHoliday(dateStr);
                  const monthStr = date.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
                  return (
                    <th key={dateStr} className={`border-b border-r border-gray-200 p-1 text-center min-w-[54px] ${holiday ? 'bg-red-50/50' : isWeekend ? 'bg-gray-100/50' : 'bg-white'}`}>
                      <div className="flex flex-col items-center leading-tight">
                        <span className={`text-xs font-black ${holiday ? 'text-red-600' : 'text-gray-700'}`}>{date.getDate()} {monthStr.replace('.', '')}</span>
                        <span className={`text-[9px] font-bold mt-1 uppercase tracking-wider text-gray-400`}>{date.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' }).replace('.', '')}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50/50 group">
                  <td className="sticky left-0 z-30 bg-white border-r border-b border-gray-200 p-4 shadow-[2px_0_8px_rgba(0,0,0,0.02)] h-14">
                    <div className="font-bold text-xs text-[#1e293b] truncate uppercase">{emp.firstName} {emp.lastName}</div>
                    <div className="text-[9px] text-gray-400 font-mono mt-1">{emp.matricule}</div>
                  </td>
                  {dates.map((date) => {
                    const dateStr = toLocalISO(date);
                    return (
                      <td key={dateStr} onClick={() => setSelectedCell({ empId: emp.id, date: dateStr })} className="border-r border-b border-gray-100 p-1 cursor-pointer transition-colors hover:bg-blue-50/40 h-14 min-w-[54px]">
                        {renderCellContent(emp.id, dateStr)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE CALENDAR VIEW */}
      {mobileView === 'calendar' && (
        <div className="md:hidden flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="relative">
              <select value={mobileSelectedEmpId || ''} onChange={(e) => setMobileSelectedEmpId(Number(e.target.value))} className="w-full p-3 border border-gray-100 rounded-xl text-sm bg-gray-50 font-bold text-gray-800 appearance-none">
                <option value="">Sélectionner un employé...</option>
                {filteredEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <div className="flex items-center justify-between px-2 bg-gray-50 rounded-xl py-2">
              <button onClick={() => changeMobileMonth(-1)} className="p-1 text-gray-400 hover:text-gray-800 transition-colors"><ChevronLeft size={24} /></button>
              <span className="text-sm font-black text-gray-800 capitalize">{mobileMonth.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => changeMobileMonth(1)} className="p-1 text-gray-400 hover:text-gray-800 transition-colors"><ChevronRight size={24} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {['L','M','M','J','V','S','D'].map((d, i) => <div key={i} className="text-center text-[9px] font-black text-gray-400 py-1 uppercase">{d}</div>)}
              {mobileCalendarDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="aspect-square bg-transparent"></div>;
                const dateStr = toLocalISO(day);
                const isToday = dateStr === toLocalISO(new Date());
                const holiday = isHoliday(dateStr);
                const isCurrentMonth = day.getMonth() === mobileMonth.getMonth();
                return (
                  <div key={dateStr} onClick={() => mobileSelectedEmpId && setSelectedCell({ empId: mobileSelectedEmpId, date: dateStr })} className={`aspect-square relative rounded-xl border flex flex-col items-center justify-center p-0.5 transition-all cursor-pointer ${!isCurrentMonth ? 'opacity-20' : 'hover:bg-blue-50 border-gray-50 bg-[#f9fafb]'}`}>
                    <span className={`text-[10px] font-black ${holiday ? 'text-red-500' : isToday ? 'text-[#3b82f6]' : 'text-gray-800'}`}>{day.getDate()}</span>
                    <div className="absolute inset-x-0 bottom-0.5 px-0.5 h-3">{mobileSelectedEmpId && renderCellContent(mobileSelectedEmpId, dateStr, true)}</div>
                  </div>
                );
              })}
            </div>
        </div>
      )}

      {/* ASSIGNMENT MODAL */}
      <Modal isOpen={!!selectedCell} onClose={() => setSelectedCell(null)} title={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''} size="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-2 bg-blue-50/50 rounded-lg border border-blue-100 shadow-sm">
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 shrink-0"><CalendarDays size={16} /></div>
                <div className="text-left leading-tight">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Date</p>
                    <p className="text-[10px] font-black text-blue-900 capitalize">{selectedCell && formatModalDate(selectedCell.date)}</p>
                </div>
             </div>
             <button onClick={() => handleShiftSelect(null)} className="px-3 py-1.5 rounded-lg border-2 border-red-50 bg-white text-red-600 hover:bg-red-50 transition-all active:scale-95 shadow-sm flex items-center gap-1.5">
                <Trash2 size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Effacer</span>
             </button>
          </div>
          <div className="space-y-4">
             <section className="space-y-2">
                <div className="flex items-center gap-1.5 pl-1 border-l-3 border-blue-500"><Zap size={14} className="text-blue-500" /><h4 className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Shifts</h4></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {settings.shifts.map(shift => (
                    <button key={shift.name} onClick={() => handleShiftSelect(shift.name)} className="group flex flex-col p-2 rounded-lg border-2 border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all text-left active:scale-95">
                        <div className="flex items-center gap-1.5 mb-1"><div className="w-0.5 h-4 rounded-full" style={{ backgroundColor: shift.color }} /><span className="font-black text-slate-900 text-[10px] truncate">{shift.name}</span></div>
                        <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold pl-2"><Clock size={8} />{shift.start} - {shift.end}</div>
                    </button>
                    ))}
                </div>
             </section>
             <section className="space-y-2">
                <div className="flex items-center gap-1.5 pl-1 border-l-3 border-orange-500"><Coffee size={14} className="text-orange-500" /><h4 className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Absences</h4></div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {settings.absenceTypes.map(type => (
                    <button key={type.name} onClick={() => handleShiftSelect(type.name)} className="group flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg border-2 border-slate-50 bg-slate-50/20 hover:bg-white hover:border-orange-200 hover:shadow-sm transition-all text-center active:scale-95">
                        <div className="p-1 rounded-md transition-all group-hover:scale-105" style={{ backgroundColor: `${type.color}15`, color: type.color }}><UserX size={14} className="opacity-90" /></div>
                        <span className="text-[8px] font-black text-slate-700 truncate w-full px-1">{type.name}</span>
                    </button>
                    ))}
                </div>
             </section>
          </div>
        </div>
      </Modal>
    </div>
  );
};
