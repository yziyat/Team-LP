
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, X, RotateCcw, UserX, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Download, Grid, CalendarDays, FileText, Image as ImageIcon, Search, Filter as FilterIcon, Info, Layers, ChevronDown } from 'lucide-react';
import { Employee, AppSettings, PlanningData, Team, User } from '../types';
import { Modal } from './ui/Modal';
import { TRANSLATIONS } from '../constants';
import { Button } from './ui/Button';
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
  const [daysToShow, setDaysToShow] = useState(7);
  const [selectedCell, setSelectedCell] = useState<{empId: number, date: string} | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [mobileMonth, setMobileMonth] = useState(new Date());
  const [mobileSelectedEmpId, setMobileSelectedEmpId] = useState<number | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isMobileExportOpen, setIsMobileExportOpen] = useState(false);

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

  useEffect(() => {
    if (filteredEmployees.length > 0 && !mobileSelectedEmpId) {
      setMobileSelectedEmpId(filteredEmployees[0].id);
    }
  }, [filteredEmployees, mobileSelectedEmpId]);

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
    setIsMobileExportOpen(false);
    const filename = `planning_${new Date().toISOString().slice(0, 10)}`;
    const teamName = teamFilter ? teams.find(t => String(t.id) === teamFilter)?.name : (settings.language === 'fr' ? 'Toutes les équipes' : 'All Teams');
    
    try {
      if (type === 'pdf') {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.text("PLANNING PERSONNEL", 14, 15);
        
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        const periodText = `${settings.language === 'fr' ? 'Période' : 'Period'}: ${formatDisplayDateLocal(startDate, settings.dateFormat)} - ${formatDisplayDateLocal(toLocalISO(dates[dates.length-1]), settings.dateFormat)}`;
        doc.text(periodText, 14, 22);
        doc.text(`${settings.language === 'fr' ? 'Équipe' : 'Team'}: ${teamName} | ${settings.language === 'fr' ? 'Exporté par' : 'Exported by'}: ${currentUser.name}`, 14, 27);

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
          styles: { fontSize: 7, cellPadding: 2, halign: 'center', valign: 'middle', font: 'helvetica', lineWidth: 0.1 },
          columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 } },
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index > 0) {
              const val = data.cell.raw as string;
              if (val && val !== '-') {
                const details = getShiftDetails(val) || getAbsenceDetails(val);
                if (details) {
                  const hex = details.color.replace('#', '');
                  const r = parseInt(hex.substring(0, 2), 16);
                  const g = parseInt(hex.substring(2, 4), 16);
                  const b = parseInt(hex.substring(4, 6), 16);
                  data.cell.styles.fillColor = [r, g, b];
                  data.cell.styles.textColor = 255;
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            }
          }
        });
        doc.save(`${filename}.pdf`);
      } else {
        const target = printRef.current;
        if (!target) return;
        
        const canvas = await html2canvas(target, { 
          scale: 3, 
          useCORS: true,
          backgroundColor: '#f8fafc',
          scrollX: -window.scrollX,
          scrollY: -window.scrollY,
          windowWidth: target.scrollWidth,
          windowHeight: target.scrollHeight,
          onclone: (clonedDoc) => {
              const el = clonedDoc.querySelector('.overflow-auto') as HTMLElement;
              if (el) {
                el.style.overflow = 'visible';
                el.style.width = 'fit-content';
              }
          }
        });
        
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert(settings.language === 'fr' ? "Erreur lors de l'exportation. Réessayez." : "Export error. Please try again.");
    }
  };

  const renderCellContent = (empId: number, dateStr: string, isSmall = false) => {
     const shiftName = planning[`${empId}_${dateStr}`];
     const shiftDetails = shiftName ? getShiftDetails(shiftName) : null;
     const absenceDetails = shiftName ? getAbsenceDetails(shiftName) : null;
     const holiday = settings.holidays.find(h => h.date === dateStr);
     const bgColor = shiftDetails ? shiftDetails.color : absenceDetails ? absenceDetails.color : '#9ca3af';
     
     if (shiftName) {
        return (
             <div className="w-full h-full rounded flex items-center justify-center p-0.5 border shadow-sm transition-all overflow-hidden" 
                  style={{ backgroundColor: `${bgColor}20`, color: bgColor, borderColor: `${bgColor}40` }}>
                 <span className={`${isSmall ? 'text-[7px]' : 'text-[9px]'} font-bold truncate leading-none`}>{shiftName.substring(0, 3)}</span>
             </div>
        );
     } else if (holiday) {
        return (
             <div className="w-full h-full flex items-center justify-center opacity-30">
                 <span className={`${isSmall ? 'text-[6px]' : 'text-[8px]'} text-red-500 font-bold uppercase transform -rotate-12`}>Férié</span>
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
    for(let i=1; i<=lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [mobileMonth]);

  return (
    <div className="space-y-4 h-full flex flex-col bg-[#f8fafc]">
      {/* MOBILE HEADER VIEW SELECTOR */}
      <div className="md:hidden flex bg-[#eef2ff] p-1 rounded-xl w-full">
          <button onClick={() => setMobileView('calendar')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${mobileView === 'calendar' ? 'bg-white text-[#3b82f6] shadow-sm' : 'text-[#64748b]'}`}>
            <CalendarDays size={18} /> {t.view_calendar}
          </button>
          <button onClick={() => setMobileView('grid')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${mobileView === 'grid' ? 'bg-[#3b82f6] text-white shadow-sm' : 'text-[#64748b]'}`}>
            <Grid size={18} /> {t.view_grid}
          </button>
      </div>

      {/* MOBILE TEAM FILTER BLOCK (SPECIFICALLY FOR MOBILE) */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FilterIcon size={18} />
          </div>
          <div className="relative flex-1">
              <select 
                value={teamFilter} 
                onChange={(e) => setTeamFilter(e.target.value)} 
                disabled={isManager}
                className="w-full pl-2 pr-8 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[12px] font-bold text-gray-700 appearance-none focus:ring-2 focus:ring-blue-100 truncate"
              >
                <option value="">{t.filter_team}</option>
                {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
      </div>

      {/* MOBILE LEGEND & EXPORT CARD */}
      <div className="md:hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Légende</h3>
              <div className="relative">
                <button onClick={() => setIsMobileExportOpen(!isMobileExportOpen)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100 flex items-center gap-1">
                    <Download size={16} />
                    <span className="text-[10px] font-bold">Export</span>
                </button>
                {isMobileExportOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMobileExportOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 hover:bg-blue-50 flex items-center gap-3 transition-colors border-b border-gray-50">
                        <FileText size={16} className="text-blue-500" /> PDF
                      </button>
                      <button onClick={() => handleExport('image')} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 hover:bg-blue-50 flex items-center gap-3 transition-colors">
                        <ImageIcon size={16} className="text-blue-500" /> Image
                      </button>
                    </div>
                  </>
                )}
              </div>
          </div>

          <div className="space-y-3">
              <div>
                  <h4 className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Shifts</h4>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {settings.shifts.map(s => (
                        <div key={s.name} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                            <span className="text-[10px] font-medium text-gray-600">{s.name}</span>
                        </div>
                    ))}
                  </div>
              </div>
              <div className="border-t border-gray-50 pt-2">
                  <h4 className="text-[9px] font-bold text-gray-400 uppercase mb-1.5">Absences</h4>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {settings.absenceTypes.map(a => (
                        <div key={a.name} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }}></div>
                            <span className="text-[10px] font-medium text-gray-600 italic">{a.name}</span>
                        </div>
                    ))}
                  </div>
              </div>
          </div>
      </div>

      {/* DESKTOP HEADER - OPTIMIZED FOR DYNAMIC WIDTHS */}
      <div className="hidden md:flex flex-wrap items-center gap-4 mb-2 w-full">
        <div className="shrink-0">
          <h2 className="text-xl lg:text-2xl font-black text-[#1e293b] leading-tight">{t.planning}</h2>
          <p className="text-[#64748b] text-[10px] lg:text-xs font-medium">{settings.language === 'fr' ? 'Gestion des shifts' : 'Shift management'}</p>
        </div>
        
        <div className="flex-1 min-w-0 flex items-center gap-1.5 bg-white px-3 py-2 rounded-2xl border border-gray-200 shadow-sm">
          {/* Team Filter - Constrained but flexible */}
          <div className="relative group shrink-1 min-w-[120px] max-w-[200px]">
            <select 
              value={teamFilter} 
              onChange={(e) => setTeamFilter(e.target.value)} 
              disabled={isManager}
              className="pl-2 pr-8 py-1.5 bg-transparent border-none text-[11px] lg:text-xs font-bold text-gray-700 focus:ring-0 appearance-none cursor-pointer w-full truncate"
            >
              <option value="">{t.filter_team}</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors" />
          </div>

          <div className="w-px h-6 bg-gray-100 mx-1 shrink-0" />

          {/* Search - Shrinkable */}
          <div className="relative flex-1 min-w-[100px] max-w-[250px]">
            <input 
              type="text" 
              placeholder={settings.language === 'fr' ? "Employé..." : "Employee..."} 
              value={employeeSearch} 
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="pl-2 pr-1 py-1.5 bg-transparent border-none text-[11px] lg:text-xs font-bold text-gray-700 placeholder:text-gray-400 focus:ring-0 w-full truncate"
            />
          </div>

          <button 
            onClick={() => {setEmployeeSearch(''); setTeamFilter('');}} 
            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded hover:bg-blue-50 shrink-0"
            title={t.reset}
          >
            <RotateCcw size={15} />
          </button>

          <div className="w-px h-6 bg-gray-100 mx-1 shrink-0" />

          {/* Date Navigation */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => changeDate(-daysToShow)} className="p-1 text-gray-400 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100">
              <ChevronLeft size={18} />
            </button>
            <div className="relative flex items-center bg-gray-50/80 rounded-xl px-2 border border-transparent hover:border-gray-200 transition-all">
               <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="bg-transparent border-none py-1.5 text-[10px] lg:text-xs font-black text-gray-700 focus:ring-0 w-24 lg:w-30 cursor-pointer" 
              />
              <CalendarIcon size={12} className="text-gray-400" />
            </div>
            <button onClick={() => changeDate(daysToShow)} className="p-1 text-gray-400 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-100 mx-1 shrink-0" />

          {/* Days Select */}
          <div className="relative group shrink-0 min-w-[70px]">
            <select 
                value={daysToShow} 
                onChange={(e) => setDaysToShow(Number(e.target.value))} 
                className="pl-2 pr-7 py-1.5 bg-transparent border-none text-[11px] lg:text-xs font-bold text-gray-700 focus:ring-0 appearance-none cursor-pointer w-full"
            >
                <option value={7}>7j</option>
                <option value={14}>14j</option>
                <option value={30}>30j</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors" />
          </div>

          <div className="w-px h-6 bg-gray-100 mx-1 shrink-0" />

          {/* Export Dropdown - ALWAYS VISIBLE ALIGNED RIGHT */}
          <div className="relative shrink-0 ml-auto">
            <button 
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
              className="flex items-center gap-2 px-3 lg:px-4 py-2 bg-[#eff6ff] text-[#3b82f6] rounded-xl border border-[#dbeafe] hover:bg-[#dbeafe] transition-all text-[11px] lg:text-xs font-black shadow-sm whitespace-nowrap"
            >
              <Download size={16} />
              <span className="hidden lg:inline">{t.export}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isExportMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-colors border-b border-gray-50">
                    <FileText size={18} className="text-blue-500" /> PDF Haute Définition
                  </button>
                  <button onClick={() => handleExport('image')} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-colors">
                    <ImageIcon size={18} className="text-blue-500" /> Image (Qualité 3x)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE GRID VIEW */}
      {mobileView === 'grid' && (
        <div className="md:hidden space-y-4 flex flex-col flex-1 animate-in fade-in duration-300">
            <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between gap-1">
                <button onClick={() => changeDate(-daysToShow)} className="p-1 text-gray-400 hover:text-gray-800 transition-colors"><ChevronLeft size={24} /></button>
                
                <div className="flex-1 flex items-center gap-1 bg-gray-50 rounded-xl px-2">
                   <div className="relative flex-1">
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)} 
                            className="w-full bg-transparent border-none py-2.5 text-[11px] font-bold text-gray-700 focus:ring-0 min-w-0" 
                        />
                   </div>
                   <div className="w-px h-6 bg-gray-200" />
                   {/* DAYS SELECT NEXT TO DATE */}
                   <div className="relative w-16">
                        <select 
                            value={daysToShow} 
                            onChange={(e) => setDaysToShow(Number(e.target.value))} 
                            className="w-full pl-1 pr-4 py-2.5 bg-transparent border-none text-[11px] font-black text-blue-600 focus:ring-0 appearance-none cursor-pointer"
                        >
                            <option value={7}>7j</option>
                            <option value={14}>14j</option>
                        </select>
                        <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                   </div>
                </div>

                <button onClick={() => changeDate(daysToShow)} className="p-1 text-gray-400 hover:text-gray-800 transition-colors"><ChevronRight size={24} /></button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1 relative min-h-[400px]">
                <div className="overflow-auto h-full touch-pan-x" ref={printRef}>
                    <table className="w-full border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-white">
                                <th className="sticky left-0 z-30 bg-white border-r border-b border-gray-100 p-3 text-left text-[10px] font-black text-gray-400 uppercase min-w-[120px] w-[120px] shadow-[2px_0_5px_rgba(0,0,0,0.02)] h-14">EMPLOYÉ</th>
                                {dates.map((date) => {
                                    const dateStr = toLocalISO(date);
                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                    const holiday = settings.holidays.find(h => h.date === dateStr);
                                    return (
                                        <th key={dateStr} className={`border-b border-r border-gray-50 p-1 text-center min-w-[48px] w-[48px] h-14 ${holiday ? 'bg-red-50' : isWeekend ? 'bg-gray-50' : 'bg-white'}`}>
                                            <div className="flex flex-col items-center justify-center leading-none">
                                                <span className={`text-[11px] font-black ${holiday ? 'text-red-600' : 'text-[#64748b]'}`}>{date.getDate()}</span>
                                                <span className={`text-[8px] font-bold mt-1 uppercase ${holiday ? 'text-red-400' : 'text-gray-300'}`}>{date.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' })[0].toUpperCase()}</span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id} className="hover:bg-gray-50/50">
                                    <td className="sticky left-0 z-10 bg-white border-r border-b border-gray-50 p-3 shadow-[2px_0_5px_rgba(0,0,0,0.02)] h-14 min-w-[120px] w-[120px]">
                                        <div className="font-bold text-[10px] text-gray-800 truncate leading-tight uppercase">{emp.firstName} {emp.lastName}</div>
                                        <div className="text-[8px] text-gray-400 font-mono researcher leading-none mt-1 tracking-widest">{emp.matricule}</div>
                                    </td>
                                    {dates.map((date) => {
                                        const dateStr = toLocalISO(date);
                                        return (
                                            <td key={dateStr} onClick={() => setSelectedCell({ empId: emp.id, date: dateStr })} className="border-r border-b border-gray-50 p-1 cursor-pointer transition-colors hover:bg-gray-50 h-14 min-w-[48px] w-[48px]">
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
        </div>
      )}

      {/* MOBILE CALENDAR VIEW */}
      {mobileView === 'calendar' && (
        <div className="md:hidden space-y-4 flex flex-col flex-1 animate-in fade-in duration-300">
           <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="relative">
                <select value={mobileSelectedEmpId || ''} onChange={(e) => setMobileSelectedEmpId(Number(e.target.value))} className="w-full p-3 border border-gray-100 rounded-xl text-sm bg-gray-50 font-bold text-gray-800 appearance-none">
                  {filteredEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <div className="flex items-center justify-between px-2 bg-gray-50 rounded-xl py-1">
                <button onClick={() => changeMobileMonth(-1)} className="p-1.5 text-gray-400 hover:text-gray-800 transition-colors"><ChevronLeft size={24} /></button>
                <span className="text-sm font-black text-gray-800 capitalize">{mobileMonth.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => changeMobileMonth(1)} className="p-1.5 text-gray-400 hover:text-gray-800 transition-colors"><ChevronRight size={24} /></button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {mobileCalendarDays.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} className="aspect-square bg-transparent"></div>;
                  const dateStr = toLocalISO(day);
                  const isToday = dateStr === toLocalISO(new Date());
                  const holiday = settings.holidays.find(h => h.date === dateStr);
                  const isCurrentMonth = day.getMonth() === mobileMonth.getMonth();
                  return (
                    <div key={dateStr} onClick={() => mobileSelectedEmpId && setSelectedCell({ empId: mobileSelectedEmpId, date: dateStr })} className={`aspect-square relative rounded-xl border flex flex-col items-center justify-center p-0.5 transition-all cursor-pointer ${!isCurrentMonth ? 'opacity-20' : 'hover:bg-blue-50 border-gray-50 bg-[#f9fafb]'}`}>
                      <span className={`text-[11px] font-black ${holiday ? 'text-red-500' : isToday ? 'text-[#3b82f6]' : 'text-gray-800'}`}>{day.getDate()}</span>
                      <div className="absolute inset-x-0 bottom-0.5 px-0.5 h-3">{mobileSelectedEmpId && renderCellContent(mobileSelectedEmpId, dateStr, true)}</div>
                    </div>
                  );
                })}
              </div>
           </div>
        </div>
      )}

      {/* DESKTOP TABLE */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1 relative">
        <div className="overflow-auto h-full" ref={printRef}>
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-50/80 backdrop-blur-md">
                <th className="sticky left-0 z-30 bg-gray-50 border-r border-b border-gray-200 p-4 text-left text-[11px] font-black text-gray-400 uppercase min-w-[150px] w-[150px] shadow-[2px_0_10px_rgba(0,0,0,0.03)] h-16">Employé</th>
                {dates.map((date) => {
                  const dateStr = toLocalISO(date);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const holiday = settings.holidays.find(h => h.date === dateStr);
                  const monthStr = date.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
                  return (
                    <th key={dateStr} className={`border-b border-r border-gray-200 p-1 text-center min-w-[54px] w-[54px] h-16 ${holiday ? 'bg-red-50/50' : isWeekend ? 'bg-gray-100/50' : 'bg-white'}`}>
                      <div className="flex flex-col items-center leading-tight">
                        <span className={`text-xs font-black whitespace-nowrap ${holiday ? 'text-red-600' : 'text-gray-700'}`}>{date.getDate()} {monthStr.replace('.', '')}.</span>
                        <span className={`text-[9px] font-bold mt-1 uppercase tracking-wider ${holiday ? 'text-red-500' : 'text-gray-400'}`}>{date.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' }).replace('.', '')}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="sticky left-0 z-10 bg-white border-r border-b border-gray-200 p-4 shadow-[2px_0_10px_rgba(0,0,0,0.03)] h-14 min-w-[150px] w-[150px]">
                    <div className="font-bold text-xs text-[#1e293b] truncate leading-tight uppercase">{emp.firstName} {emp.lastName}</div>
                    <div className="text-[9px] text-gray-400 font-mono leading-none mt-1.5 tracking-widest">{emp.matricule}</div>
                  </td>
                  {dates.map((date) => {
                    const dateStr = toLocalISO(date);
                    return (
                      <td key={dateStr} onClick={() => setSelectedCell({ empId: emp.id, date: dateStr })} className="border-r border-b border-gray-100 p-1.5 cursor-pointer transition-all hover:bg-blue-50/50 h-14 min-w-[54px] w-[54px]">
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

      {/* ASSIGNMENT MODAL */}
      <Modal isOpen={!!selectedCell} onClose={() => setSelectedCell(null)} title={selectedCell ? `Assigner à: ${employees.find(e => e.id === selectedCell.empId)?.firstName} ${employees.find(e => e.id === selectedCell.empId)?.lastName}` : ''} size="sm">
        <div className="space-y-6">
          <p className="text-sm text-gray-500 text-center font-semibold capitalize">{selectedCell && formatModalDate(selectedCell.date)}</p>
          <div className="max-h-[500px] overflow-y-auto pr-1 space-y-6">
             <button onClick={() => handleShiftSelect(null)} className="w-full p-3 rounded-xl border border-red-100 bg-red-50 text-red-600 font-bold hover:bg-red-100 flex items-center justify-center gap-2 transition-colors"><X size={18} /> Effacer</button>
             <section className="space-y-3">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">SHIFTS</h4>
                <div className="space-y-2">
                    {settings.shifts.map(shift => (
                    <button key={shift.name} onClick={() => handleShiftSelect(shift.name)} className="w-full p-3 rounded-xl border border-gray-100 flex items-center justify-between hover:shadow-md transition-all bg-white text-left" style={{ borderLeft: `4px solid ${shift.color}` }}>
                        <span className="font-bold text-gray-800 text-sm">{shift.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium"><Clock size={12} />{shift.start} - {shift.end}</div>
                    </button>
                    ))}
                </div>
             </section>
             <section className="space-y-3">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">ABSENCES</h4>
                <div className="grid grid-cols-2 gap-2">
                    {settings.absenceTypes.map(type => (
                    <button key={type.name} onClick={() => handleShiftSelect(type.name)} className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all text-center group" style={{ backgroundColor: `${type.color}10`, borderColor: `${type.color}20`, color: type.color }}>
                        <UserX size={18} className="opacity-80" /><span className="text-xs font-bold">{type.name}</span>
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
