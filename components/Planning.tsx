
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, X, RotateCcw, UserX, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Download, Grid, CalendarDays, Image as ImageIcon, FileText, AlertCircle, ChevronDown } from 'lucide-react';
import { Employee, AppSettings, PlanningData, Team, User } from '../types';
import { Modal } from './ui/Modal';
import { TRANSLATIONS } from '../constants';
import { Button } from './ui/Button';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const printRef = useRef<HTMLDivElement>(null);
  const mobilePrintRef = useRef<HTMLDivElement>(null);
  
  // DESKTOP State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Start of week (Mon)
    return d.toISOString().split('T')[0];
  });
  const [daysToShow, setDaysToShow] = useState(7);
  
  // COMMON State
  const [selectedCell, setSelectedCell] = useState<{empId: number, date: string} | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // MOBILE State
  const [mobileMonth, setMobileMonth] = useState(new Date());
  const [mobileSelectedEmpId, setMobileSelectedEmpId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<'calendar' | 'grid'>('calendar');

  // Determine which team the current user leads (if any)
  const managedTeam = teams.find(t => t.leaderId === currentUser.employeeId);
  const isManager = currentUser.role === 'manager' && !!managedTeam;

  // Effect to auto-filter for managers
  useEffect(() => {
    if (isManager && managedTeam) {
      setTeamFilter(String(managedTeam.id));
    }
  }, [isManager, managedTeam]);

  // Filter Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = 
        emp.firstName.toLowerCase().includes(employeeSearch.toLowerCase()) || 
        emp.lastName.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        emp.matricule.toLowerCase().includes(employeeSearch.toLowerCase());
      
      const effectiveTeamFilter = isManager && managedTeam ? String(managedTeam.id) : teamFilter;
      const matchesTeam = effectiveTeamFilter ? emp.teamId?.toString() === effectiveTeamFilter : true;
      const isActive = !emp.exitDate;

      return matchesSearch && matchesTeam && isActive;
    }).sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [employees, employeeSearch, teamFilter, isManager, managedTeam]);

  // Set default mobile employee
  useEffect(() => {
    if (filteredEmployees.length > 0 && !mobileSelectedEmpId) {
      setMobileSelectedEmpId(filteredEmployees[0].id);
    }
  }, [filteredEmployees, mobileSelectedEmpId]);

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
  const getAbsenceDetails = (name: string) => settings.absenceTypes.find(a => a.name === name);

  // Helper to get formatted filename
  const getExportFilename = (prefix: string) => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
      const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
      return `${prefix}_${dateStr}_${timeStr}`;
  };

  // --- DESKTOP HELPERS ---
  const dates: Date[] = [];
  const current = new Date(startDate);
  for (let i = 0; i < daysToShow; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Export Logic
  const handleExport = async (type: 'pdf' | 'image') => {
      setIsExportMenuOpen(false);
      const filename = getExportFilename('planning');

      if (type === 'pdf') {
          // Native PDF Generation using autotable for best quality
          const doc = new jsPDF('landscape');
          
          doc.setFontSize(16);
          doc.text(`Team LP - Planning (${startDate})`, 14, 15);
          doc.setFontSize(10);
          doc.text(`Exported on ${new Date().toLocaleString()}`, 14, 22);

          // Prepare columns
          const columns = [
             { header: 'Employee', dataKey: 'name' },
             ...dates.map(d => ({ 
                 header: `${d.getDate()} ${d.toLocaleDateString(settings.language==='fr'?'fr-FR':'en-US', {weekday:'short'})}`, 
                 dataKey: d.toISOString().split('T')[0] 
             }))
          ];

          // Prepare data
          const data = filteredEmployees.map(emp => {
              const row: any = { name: `${emp.firstName} ${emp.lastName}` };
              dates.forEach(d => {
                  const dateStr = d.toISOString().split('T')[0];
                  row[dateStr] = planning[`${emp.id}_${dateStr}`] || '';
              });
              return row;
          });

          autoTable(doc, {
             head: [columns.map(c => c.header)],
             body: data.map(row => columns.map(c => row[c.dataKey])),
             startY: 25,
             styles: { fontSize: 8, cellPadding: 2, overflow: 'ellipsize' },
             headStyles: { fillColor: [41, 128, 185], textColor: 255 },
             didParseCell: (data) => {
                 if (data.section === 'body' && data.column.index > 0) {
                     const shiftName = data.cell.raw as string;
                     if (shiftName) {
                         const shift = getShiftDetails(shiftName);
                         const absence = getAbsenceDetails(shiftName);
                         const colorHex = shift?.color || absence?.color;
                         
                         if (colorHex) {
                             // Convert hex to rgb
                             const r = parseInt(colorHex.slice(1, 3), 16);
                             const g = parseInt(colorHex.slice(3, 5), 16);
                             const b = parseInt(colorHex.slice(5, 7), 16);
                             
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
          // High Quality Image Export with Node Cloning
          // This avoids scrollbar issues and blurry text
          const isMobileVisible = window.getComputedStyle(mobilePrintRef.current!).display !== 'none';
          const sourceRef = isMobileVisible ? mobilePrintRef.current : printRef.current;

          if (!sourceRef) return;
          
          try {
              // 1. Create a clone of the table/container
              const clone = sourceRef.cloneNode(true) as HTMLElement;
              
              // 2. Style the clone to be full width/height and remove scrollbars
              clone.style.position = 'absolute';
              clone.style.top = '-9999px';
              clone.style.left = '0';
              clone.style.width = 'fit-content'; // Ensure full width
              clone.style.height = 'auto';
              clone.style.overflow = 'visible'; // Remove scroll
              clone.style.background = 'white';
              clone.style.zIndex = '9999';

              // Remove sticky positioning from headers in the clone so they don't overlap weirdly
              const stickyElements = clone.querySelectorAll('.sticky');
              stickyElements.forEach((el) => {
                 (el as HTMLElement).style.position = 'static';
              });
              
              document.body.appendChild(clone);

              // 3. Render the clone
              const canvas = await html2canvas(clone, { 
                  scale: 3, // High DPI
                  useCORS: true,
                  backgroundColor: '#ffffff',
                  windowWidth: clone.scrollWidth,
                  windowHeight: clone.scrollHeight
              });

              // 4. Cleanup
              document.body.removeChild(clone);

              const imgData = canvas.toDataURL('image/png');
              
              const link = document.createElement('a');
              link.href = imgData;
              link.download = `${filename}.png`;
              link.click();
          } catch (err) {
              console.error("Export failed", err);
              alert("Export failed");
          }
      }
  };


  // --- MOBILE CALENDAR HELPERS ---
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    // Convert to Mon=0 ... Sun=6
    const startDayIndex = (firstDay + 6) % 7;
    
    const calendarDays = [];
    // Padding
    for (let i = 0; i < startDayIndex; i++) {
      calendarDays.push(null);
    }
    // Days
    for (let i = 1; i <= days; i++) {
      calendarDays.push(new Date(year, month, i));
    }
    return calendarDays;
  };

  const changeMobileMonth = (delta: number) => {
    const newDate = new Date(mobileMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setMobileMonth(newDate);
  };

  const mobileCalendarDays = getDaysInMonth(mobileMonth);
  
  // Shared Render Cell Function
  const renderCell = (empId: number, dateStr: string, isMobile = false) => {
     const shiftName = planning[`${empId}_${dateStr}`];
     const shiftDetails = shiftName ? getShiftDetails(shiftName) : null;
     const absenceDetails = shiftName ? getAbsenceDetails(shiftName) : null;
     const holiday = settings.holidays.find(h => h.date === dateStr);
     
     const bgColor = shiftDetails ? shiftDetails.color : absenceDetails ? absenceDetails.color : '#9ca3af';
     
     // Base style for any badge
     const badgeBase = `w-full h-full rounded flex flex-col items-center justify-center p-0.5 text-xs border shadow-sm transition-all overflow-hidden`;

     let content = null;

     if (shiftName) {
        const style = { 
            backgroundColor: `${bgColor}${isMobile ? '' : '20'}`, // Solid on mobile, Tint on desktop
            color: isMobile ? 'white' : bgColor, 
            borderColor: isMobile ? 'transparent' : `${bgColor}40` 
        };
        
        content = (
             <div className={badgeBase} style={style}>
                 <span className="font-bold truncate w-full text-center text-[10px] leading-tight">{shiftName.substring(0, isMobile ? 3 : 10)}</span>
                 {!isMobile && shiftDetails && (
                    <span className="text-[9px] opacity-75">{shiftDetails.start}-{shiftDetails.end}</span>
                 )}
             </div>
        );
     } else if (holiday && !isMobile) {
        content = (
             <div className="w-full h-full flex items-center justify-center">
                 <span className="text-[10px] text-red-300 transform -rotate-45 select-none">Férié</span>
             </div>
        );
     }

     return content;
  };
  
  // Holiday Check for Modal
  const isSelectedDateHoliday = selectedCell ? settings.holidays.find(h => h.date === selectedCell.date) : null;
  
  // Get Selected Employee for Modal Title
  const selectedEmployeeForModal = selectedCell ? employees.find(e => e.id === selectedCell.empId) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.planning}</h2>
          <p className="text-gray-500">{settings.language === 'fr' ? 'Gestion des shifts' : 'Shift management'}</p>
        </div>
        
        {/* Desktop Controls */}
        <div className="hidden md:flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
           {/* Filters */}
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
          <input 
            type="text"
            placeholder={t.filter_employee}
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-blue-500"
          />
          {!isManager && (
            <button onClick={handleResetFilters} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title={t.reset}>
              <RotateCcw size={16} />
            </button>
          )}

          <div className="h-6 w-px bg-gray-200 mx-1"></div>

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
           
           <div className="h-6 w-px bg-gray-200 mx-1"></div>
           
           <div className="relative">
             <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors text-sm font-medium"
             >
                <Download size={16} />
                {t.export}
                <ChevronDown size={14} />
             </button>
             {isExportMenuOpen && (
               <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                     <FileText size={14} /> {t.export_pdf}
                  </button>
                  <button onClick={() => handleExport('image')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                     <ImageIcon size={14} /> {t.export_image}
                  </button>
               </div>
             )}
             {isExportMenuOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)}></div>
             )}
           </div>
        </div>
        
        {/* Mobile View Switcher */}
        <div className="md:hidden flex bg-white rounded-lg border border-gray-200 p-1 w-full">
            <button 
                onClick={() => setMobileView('calendar')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mobileView === 'calendar' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <CalendarDays size={16} />
                {t.view_calendar}
            </button>
            <button 
                onClick={() => setMobileView('grid')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mobileView === 'grid' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Grid size={16} />
                {t.view_grid}
            </button>
        </div>
      </div>

      {/* --- MOBILE VIEW --- */}
      <div className="md:hidden" ref={mobilePrintRef}>
         {/* Grouped Legend & Exports for Mobile */}
         <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4">
            <div className="flex justify-between items-center mb-2 border-b pb-2">
                 <span className="text-xs font-bold text-gray-700 uppercase">Legend</span>
                 <div className="relative">
                    <button 
                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
                        className="p-1 text-blue-600 border rounded bg-blue-50"
                    >
                        <Download size={16} />
                    </button>
                    {isExportMenuOpen && (
                         <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-50">
                             <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-b">
                                <FileText size={12} /> {t.export_pdf}
                             </button>
                             <button onClick={() => handleExport('image')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                <ImageIcon size={12} /> {t.export_image}
                             </button>
                         </div>
                    )}
                 </div>
            </div>
            
            <div className="mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Shifts</span>
                <div className="flex flex-wrap gap-2">
                    {settings.shifts.map(s => (
                        <div key={s.name} className="flex items-center gap-1 text-[10px] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></div>
                            <span>{s.name}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                 <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Absences</span>
                 <div className="flex flex-wrap gap-2">
                    {settings.absenceTypes.map(a => (
                        <div key={a.name} className="flex items-center gap-1 text-[10px] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }}></div>
                            <span>{a.name}</span>
                        </div>
                    ))}
                     <div className="flex items-center gap-1 text-[10px] bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        <span>Férié</span>
                    </div>
                </div>
            </div>
         </div>

         {mobileView === 'calendar' ? (
             <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
                    {/* Employee Selector */}
                    <div>
                        <select 
                            className="w-full p-2 border border-gray-300 rounded-lg bg-white font-medium text-gray-800"
                            value={mobileSelectedEmpId || ''}
                            onChange={(e) => setMobileSelectedEmpId(Number(e.target.value))}
                        >
                            {filteredEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Month Navigator with Native Picker Overlay */}
                    <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg relative">
                        <button onClick={() => changeMobileMonth(-1)} className="p-1 hover:bg-gray-200 rounded z-10">
                            <ChevronLeft size={20} />
                        </button>
                        
                        <div className="relative flex-1 text-center">
                            <span className="font-bold text-gray-800 pointer-events-none">
                                {mobileMonth.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })}
                            </span>
                            <input 
                                type="month" 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                                value={mobileMonth.toISOString().slice(0, 7)}
                                onChange={(e) => setMobileMonth(new Date(e.target.value + '-01'))}
                            />
                        </div>

                        <button onClick={() => changeMobileMonth(1)} className="p-1 hover:bg-gray-200 rounded z-10">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Calendar Grid */}
                    {mobileSelectedEmpId && (
                        <div className="grid grid-cols-7 gap-1 text-center">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
                                <div key={d} className="text-[10px] font-bold text-gray-400 uppercase py-1">{d}</div>
                            ))}
                            
                            {mobileCalendarDays.map((date, i) => {
                                if (!date) return <div key={`empty-${i}`} className="aspect-square bg-gray-50/50 rounded-lg"></div>;
                                
                                const dateStr = date.toISOString().split('T')[0];
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                const holiday = settings.holidays.find(h => h.date === dateStr);
                                
                                const shiftName = planning[`${mobileSelectedEmpId}_${dateStr}`];
                                const shiftDetails = shiftName ? getShiftDetails(shiftName) : null;
                                const absenceDetails = shiftName ? getAbsenceDetails(shiftName) : null;
                                
                                let cellStyle = {};
                                const bgColor = shiftDetails ? shiftDetails.color : absenceDetails ? absenceDetails.color : '#ef4444'; 

                                if (holiday) cellStyle = { backgroundColor: '#fee2e2' };
                                else if (shiftName) cellStyle = { backgroundColor: bgColor, color: 'white' };
                                else if (isWeekend) cellStyle = { backgroundColor: '#f8fafc' };

                                return (
                                <div 
                                    key={dateStr}
                                    onClick={() => setSelectedCell({ empId: mobileSelectedEmpId, date: dateStr })}
                                    className="aspect-square rounded-lg border border-gray-100 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden"
                                    style={cellStyle}
                                >
                                    <span className={`text-xs font-semibold z-10 ${shiftName ? 'text-white' : 'text-gray-700'}`}>
                                        {date.getDate()}
                                    </span>
                                    {shiftName && (
                                        <span className={`text-[9px] leading-tight truncate px-0.5 w-full z-10 text-white/90`}>
                                        {shiftName.substring(0, 3)}
                                        </span>
                                    )}
                                    {holiday && !shiftName && (
                                        <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
             </div>
         ) : (
             /* Mobile Grid View (Simplified Table) */
             <div className="space-y-3">
                 {/* Mobile Grid Date Control */}
                 <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none flex-1"
                    />
                    <select 
                        value={daysToShow} 
                        onChange={(e) => setDaysToShow(Number(e.target.value))}
                        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none bg-white"
                    >
                        <option value={7}>7 Days</option>
                        <option value={3}>3 Days</option>
                    </select>
                 </div>

                 <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                     <table className="w-full border-collapse">
                         <thead>
                            <tr>
                                <th className="p-3 text-left text-xs font-bold text-gray-500 uppercase bg-gray-50 sticky left-0 z-10 border-b border-r border-gray-200">
                                    {settings.language === 'fr' ? 'Emp.' : 'Emp.'}
                                </th>
                                {dates.map(date => (
                                    <th key={date.toISOString()} className="p-2 text-center border-b border-gray-200 min-w-[50px]">
                                        <div className="text-[10px] text-gray-400">{date.getDate()}</div>
                                        <div className="text-[9px] text-gray-300">{date.toLocaleDateString(settings.language==='fr'?'fr-FR':'en-US', {weekday:'narrow'})}</div>
                                    </th>
                                ))}
                            </tr>
                         </thead>
                         <tbody>
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id}>
                                    <td className="p-2 sticky left-0 bg-white border-r border-gray-200 text-xs font-medium text-gray-900 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                                        {emp.firstName}
                                    </td>
                                    {dates.map(date => (
                                        <td 
                                            key={date.toISOString()} 
                                            className="border-b border-r border-gray-100 p-0.5 h-12 w-12"
                                            onClick={() => setSelectedCell({ empId: emp.id, date: date.toISOString().split('T')[0] })}
                                        >
                                            {renderCell(emp.id, date.toISOString().split('T')[0], true)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                         </tbody>
                     </table>
                 </div>
             </div>
         )}
      </div>

      {/* --- DESKTOP VIEW --- */}
      <div className="hidden md:flex bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex-col min-h-[500px]">
        <div className="overflow-x-auto flex-1" ref={printRef}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 border-r border-b border-gray-200 min-w-[200px] p-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                  {settings.language === 'fr' ? 'Employé' : 'Employee'}
                </th>
                {dates.map((date, index) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const holiday = settings.holidays.find(h => h.date === dateStr);
                  
                  const prevDate = index > 0 ? dates[index - 1] : null;
                  const isNewMonth = prevDate && prevDate.getMonth() !== date.getMonth();
                  
                  return (
                    <th key={dateStr} className={`min-w-[60px] p-2 text-center border-b border-gray-200 border-r border-gray-100 last:border-r-0 ${isNewMonth ? 'border-l-4 border-l-blue-300' : ''} ${holiday ? 'bg-red-50' : isWeekend ? 'bg-slate-50' : 'bg-white'}`}>
                      <div className="flex flex-col items-center justify-center leading-tight">
                        <span className={`text-xs font-bold ${holiday ? 'text-red-600' : 'text-gray-700'}`}>
                            {date.getDate()} {date.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' })}
                        </span>
                        <span className={`text-[10px] uppercase font-medium mt-0.5 ${holiday ? 'text-red-500' : 'text-gray-400'}`}>
                          {date.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' })}
                        </span>
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
                  {dates.map((date, index) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const holiday = settings.holidays.find(h => h.date === dateStr);
                    
                    const prevDate = index > 0 ? dates[index - 1] : null;
                    const isNewMonth = prevDate && prevDate.getMonth() !== date.getMonth();

                    return (
                      <td 
                        key={dateStr} 
                        onClick={() => setSelectedCell({ empId: emp.id, date: dateStr })}
                        className={`border-b border-r border-gray-100 last:border-r-0 p-1 cursor-pointer transition-colors hover:bg-gray-100 relative h-12 ${isNewMonth ? 'border-l-4 border-l-blue-300' : ''} ${holiday ? 'bg-red-50/30' : isWeekend ? 'bg-slate-50/50' : ''}`}
                      >
                         {renderCell(emp.id, dateStr)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shift Selection Modal */}
      <Modal 
        isOpen={!!selectedCell} 
        onClose={() => setSelectedCell(null)} 
        title={selectedEmployeeForModal 
            ? `${t.assign_to}: ${selectedEmployeeForModal.firstName} ${selectedEmployeeForModal.lastName}` 
            : (settings.language === 'fr' ? 'Assigner un shift' : 'Assign shift')
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 text-center">
            {selectedCell && new Date(selectedCell.date).toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          
          {/* Holiday Alert in Modal */}
          {isSelectedDateHoliday && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                  <AlertCircle size={18} />
                  <span>Public Holiday: <strong>{isSelectedDateHoliday.name}</strong></span>
              </div>
          )}

          <div className="max-h-[400px] overflow-y-auto pr-1">
             <button 
              onClick={() => handleShiftSelect(null)}
              className="w-full p-2 mb-3 rounded-lg border border-red-100 bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <X size={16} />
              {settings.language === 'fr' ? 'Effacer' : 'Clear'}
            </button>
            
            {/* Shifts - Grid Layout for consistency */}
            <div className="text-xs font-semibold text-gray-500 uppercase mt-2 mb-1">Shifts</div>
            <div className="grid grid-cols-2 gap-2">
                {settings.shifts.map(shift => (
                <button
                    key={shift.name}
                    onClick={() => handleShiftSelect(shift.name)}
                    className="p-2 rounded-lg border border-gray-200 hover:shadow-md transition-all text-left flex flex-col justify-center min-h-[50px]"
                    style={{ borderLeftWidth: '4px', borderLeftColor: shift.color || '#3b82f6' }}
                >
                    <div className="font-semibold text-gray-800 text-xs truncate w-full">{shift.name}</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                    <Clock size={10} />
                    {shift.start} - {shift.end}
                    </div>
                </button>
                ))}
            </div>

            {/* Absence Types - Grid Layout for consistency */}
            {settings.absenceTypes.length > 0 && (
                <>
                <div className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-1">Absences</div>
                <div className="grid grid-cols-2 gap-2">
                    {settings.absenceTypes.map(type => (
                        <button
                            key={type.name}
                            onClick={() => handleShiftSelect(type.name)}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-medium transition-colors flex flex-col items-center justify-center gap-1 min-h-[50px]"
                            style={{ color: type.color, borderColor: `${type.color}40`, backgroundColor: `${type.color}10` }}
                        >
                            <UserX size={14} />
                            <span className="truncate w-full text-center">{type.name}</span>
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