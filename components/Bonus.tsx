
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppSettings, Bonus as BonusType, Employee, Team, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { Filter, Award, Search, History, Download, FileText, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronDown, LayoutList, Grid, Lock } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BonusProps {
  employees: Employee[];
  teams: Team[];
  bonuses: BonusType[];
  settings: AppSettings;
  currentUser: User;
  onUpdateBonus: (empId: number, month: string, amount: number) => void;
}

export const Bonus: React.FC<BonusProps> = ({ employees, teams, bonuses, settings, currentUser, onUpdateBonus }) => {
  const t = TRANSLATIONS[settings.language];
  const historyRef = useRef<HTMLDivElement>(null);
  
  // Calculate current month in local time for default and validation
  const currentMonthStr = useMemo(() => {
     const now = new Date();
     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  // Mobile View State
  const [mobileView, setMobileView] = useState<'list' | 'card'>('list');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Input Pagination State
  const [inputItemsPerPage, setInputItemsPerPage] = useState<number | 'all'>(25);
  const [inputCurrentPage, setInputCurrentPage] = useState(1);

  // History Filters
  const [historyPersonFilter, setHistoryPersonFilter] = useState('');
  const [historyMonthsToShow, setHistoryMonthsToShow] = useState<number>(3);
  const [historyPageOffset, setHistoryPageOffset] = useState(0); // 0 = most recent page
  
  // Pagination State for History Rows (Employees)
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Determine Manager status
  const managedTeam = teams.find(t => t.leaderId === currentUser.employeeId);
  const isManager = currentUser.role === 'manager' && !!managedTeam;

  // Initialize view based on role
  useEffect(() => {
    if (isManager && managedTeam) {
        setSelectedTeam(String(managedTeam.id));
    }
  }, [isManager, managedTeam]);

  // Main Input Logic
  const eligibleEmployees = useMemo(() => {
    return employees.filter(emp => {
        // If Manager, force team filter. If Admin/Other, check selectedTeam state.
        const effectiveTeamFilter = isManager && managedTeam ? String(managedTeam.id) : selectedTeam;
        const inTeam = effectiveTeamFilter ? emp.teamId?.toString() === effectiveTeamFilter : true;
        
        const matchesSearch = 
            emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
            emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.matricule.toLowerCase().includes(searchTerm.toLowerCase());
        
        return inTeam && emp.isBonusEligible && matchesSearch && !emp.exitDate;
    }).sort((a, b) => a.firstName.localeCompare(b.firstName)); // Alphabetical Sort
  }, [employees, selectedTeam, searchTerm, isManager, managedTeam]);

  // Reset card index and pagination when list changes
  useEffect(() => {
    setCurrentCardIndex(0);
    setInputCurrentPage(1);
  }, [eligibleEmployees.length, selectedTeam, searchTerm]);

  // Pagination Logic for Input
  const totalInputItems = eligibleEmployees.length;
  const totalInputPages = inputItemsPerPage === 'all' ? 1 : Math.ceil(totalInputItems / inputItemsPerPage);
  
  const paginatedInputEmployees = inputItemsPerPage === 'all' 
    ? eligibleEmployees 
    : eligibleEmployees.slice((inputCurrentPage - 1) * inputItemsPerPage, inputCurrentPage * inputItemsPerPage);

  const startInputItem = inputItemsPerPage === 'all' ? 1 : (inputCurrentPage - 1) * (inputItemsPerPage as number) + 1;
  const endInputItem = inputItemsPerPage === 'all' ? totalInputItems : Math.min(inputCurrentPage * (inputItemsPerPage as number), totalInputItems);


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

  const handlePrevCard = () => {
    if (currentCardIndex > 0) setCurrentCardIndex(prev => prev - 1);
  };

  const handleNextCard = () => {
    if (currentCardIndex < eligibleEmployees.length - 1) setCurrentCardIndex(prev => prev + 1);
  };

  const changeSelectedMonth = (delta: number) => {
      const [year, month] = selectedMonth.split('-').map(Number);
      const date = new Date(year, month - 1 + delta, 1);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      setSelectedMonth(`${y}-${m}`);
  };

  // Determine if input should be disabled (Future months)
  const isInputDisabled = selectedMonth > currentMonthStr;

  // Helper to get formatted filename
  const getExportFilename = (prefix: string) => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
      const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
      return `${prefix}_${dateStr}_${timeStr}`;
  };

  // Helper to format month header
  const formatMonthHeader = (yyyyMm: string) => {
      const d = new Date(`${yyyyMm}-01`);
      const str = d.toLocaleDateString(settings.language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: 'numeric' });
      // Capitalize first letter
      return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // PIVOT TABLE LOGIC FOR HISTORY
  // 1. Determine anchor month (max of current date or latest bonus)
  // Re-using currentMonthStr from top level scope
  
  const { maxBonusMonth, minBonusMonth } = useMemo(() => {
    if (bonuses.length === 0) return { maxBonusMonth: currentMonthStr, minBonusMonth: currentMonthStr };
    const sorted = bonuses.map(b => b.month).sort(); // ascending
    return { maxBonusMonth: sorted[sorted.length - 1], minBonusMonth: sorted[0] };
  }, [bonuses, currentMonthStr]);

  const anchorMonthStr = maxBonusMonth > currentMonthStr ? maxBonusMonth : currentMonthStr;

  // 2. Generate visible months based on pagination (Procedural generation to ensure fixed count)
  const visibleMonths = useMemo(() => {
    const months = [];
    const [anchorYear, anchorMonth] = anchorMonthStr.split('-').map(Number);
    
    // Start index for this page
    const startOffset = historyPageOffset * historyMonthsToShow;
    
    for (let i = 0; i < historyMonthsToShow; i++) {
        // Javascript Date month is 0-11. anchorMonth is 1-12.
        const d = new Date(anchorYear, (anchorMonth - 1) - (startOffset + i), 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.push(`${y}-${m}`);
    }
    // Reverse to show Oldest (Left) -> Newest (Right)
    return months.reverse();
  }, [anchorMonthStr, historyPageOffset, historyMonthsToShow]);

  const hasNewerMonths = historyPageOffset > 0;
  // Enable Older button (Left) if the oldest displayed month (index 0) is still newer than our oldest data
  const hasOlderMonths = visibleMonths.length > 0 && visibleMonths[0] > minBonusMonth; 

  const handleHistoryNext = () => {
      if (hasOlderMonths) setHistoryPageOffset(p => p + 1); // Go Older (Increase offset)
  };

  const handleHistoryPrev = () => {
      if (hasNewerMonths) setHistoryPageOffset(p => p - 1); // Go Newer (Decrease offset)
  };

  const handleMonthsCountChange = (val: number) => {
      setHistoryMonthsToShow(val);
      setHistoryPageOffset(0);
  };

  // 3. Get Employees for History and Filter
  const employeesWithBonuses = employees.filter(emp => {
      const hasBonus = bonuses.some(b => b.employeeId === emp.id);
      const matchesName = historyPersonFilter 
        ? (emp.firstName.toLowerCase().includes(historyPersonFilter.toLowerCase()) || 
           emp.lastName.toLowerCase().includes(historyPersonFilter.toLowerCase()))
        : true;
        
      // Also apply team filter to history if manager
      const effectiveTeamFilter = isManager && managedTeam ? String(managedTeam.id) : '';
      const inTeam = effectiveTeamFilter ? emp.teamId?.toString() === effectiveTeamFilter : true;

      return hasBonus && matchesName && inTeam;
  }).sort((a, b) => a.firstName.localeCompare(b.firstName));

  // 4. Pagination Logic for Rows
  const totalItems = employeesWithBonuses.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);
  
  const paginatedEmployees = itemsPerPage === 'all' 
    ? employeesWithBonuses 
    : employeesWithBonuses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startItem = itemsPerPage === 'all' ? 1 : (currentPage - 1) * (itemsPerPage as number) + 1;
  const endItem = itemsPerPage === 'all' ? totalItems : Math.min(currentPage * (itemsPerPage as number), totalItems);

  // Export Logic
  const handleExport = async (type: 'pdf' | 'image') => {
      setIsExportMenuOpen(false);
      const filename = getExportFilename('bonus');
      
      if (type === 'pdf') {
          const doc = new jsPDF('landscape');
          doc.text("Bonus History", 14, 15);
          
          const columns: { header: string; dataKey: string }[] = [
              { header: 'Employee', dataKey: 'name' },
              ...visibleMonths.map(m => ({ header: formatMonthHeader(m), dataKey: m }))
          ];

          const data = employeesWithBonuses.map(emp => {
              const row: Record<string, string | number> = { name: `${emp.firstName} ${emp.lastName}` };
              visibleMonths.forEach(m => {
                  row[m] = getBonusAmount(emp.id, m);
              });
              return row;
          });

          autoTable(doc, {
              head: [columns.map(c => c.header)],
              body: data.map((row) => columns.map(c => row[c.dataKey])),
              startY: 20,
              styles: { fontSize: 10 },
              didParseCell: (dataVal: any) => {
                   if (dataVal.section === 'body' && dataVal.column.index > 0) {
                        if (dataVal.cell.raw) {
                             dataVal.cell.styles.textColor = [22, 163, 74]; // green-600
                             dataVal.cell.styles.fontStyle = 'bold';
                        }
                   }
              }
          });
          doc.save(`${filename}.pdf`);
      } else {
          // High Quality Image Export with Cloning
          if (!historyRef.current) return;
          try {
                // Clone the node to clean it up for export
                const clone = historyRef.current.cloneNode(true) as HTMLElement;
                
                clone.style.position = 'absolute';
                clone.style.top = '-9999px';
                clone.style.left = '0';
                clone.style.width = 'fit-content';
                clone.style.height = 'auto';
                clone.style.overflow = 'visible';
                clone.style.background = 'white';
                clone.style.zIndex = '9999';
                clone.style.padding = '20px';

                document.body.appendChild(clone);

                const canvas = await html2canvas(clone, { 
                    scale: 3, 
                    useCORS: true, 
                    backgroundColor: '#ffffff',
                    windowWidth: clone.scrollWidth,
                    windowHeight: clone.scrollHeight
                });

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

  const currentEmployee = eligibleEmployees[currentCardIndex];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.bonus}</h2>
          <p className="text-gray-500">{t.bonus_management}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* INPUT SECTION */}
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                <Award size={20} className="text-blue-600"/> Input Scores
            </h3>
            
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                 <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Team</label>
                        <select
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeam(e.target.value)}
                            disabled={isManager}
                            className={`w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white ${isManager ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        >
                        <option value="">{t.select_team}</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                        </select>
                    </div>
                    <div>
                         <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Month</label>
                         <div className="flex items-center gap-1">
                             <button 
                                onClick={() => changeSelectedMonth(-1)}
                                className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                             >
                                <ChevronLeft size={16} />
                             </button>
                             <input 
                                type="month" 
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg border focus:outline-none ${isInputDisabled ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-gray-200'}`}
                            />
                             <button 
                                onClick={() => changeSelectedMonth(1)}
                                className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                             >
                                <ChevronRight size={16} />
                             </button>
                        </div>
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

            {/* Mobile View Switcher */}
            <div className="md:hidden flex bg-white rounded-lg border border-gray-200 p-1 w-full">
                <button 
                    onClick={() => setMobileView('list')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mobileView === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <LayoutList size={16} />
                    {settings.language === 'fr' ? 'Liste' : 'List'}
                </button>
                <button 
                    onClick={() => setMobileView('card')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mobileView === 'card' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    <Grid size={16} />
                    {settings.language === 'fr' ? 'Cartes' : 'Cards'}
                </button>
            </div>

            {/* CARD VIEW (Mobile Only) */}
            {mobileView === 'card' && (
                <div className="md:hidden bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col items-center text-center space-y-6 min-h-[300px] justify-center relative">
                    {eligibleEmployees.length > 0 && currentEmployee ? (
                        <>
                             {/* Employee Info */}
                             <div className="space-y-2">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto">
                                    {currentEmployee.firstName[0]}
                                    {currentEmployee.lastName[0]}
                                </div>
                                <h4 className="text-xl font-bold text-gray-900">
                                    {currentEmployee.firstName} {currentEmployee.lastName}
                                </h4>
                                <p className="text-sm text-gray-500 font-mono">
                                    {currentEmployee.matricule}
                                </p>
                             </div>

                             {/* Input */}
                             <div className="w-full max-w-[200px] relative">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                                    {t.score}
                                </label>
                                {isInputDisabled && (
                                    <div className="absolute top-8 right-3 text-gray-400 z-10">
                                        <Lock size={16} />
                                    </div>
                                )}
                                <input 
                                    type="number" 
                                    min="0"
                                    placeholder={isInputDisabled ? "" : "0"}
                                    disabled={isInputDisabled}
                                    className={`w-full px-4 py-3 text-2xl text-center border-2 rounded-xl focus:ring-4 outline-none transition-all font-bold ${
                                        isInputDisabled 
                                        ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                                        : 'border-gray-200 focus:ring-blue-100 focus:border-blue-500 text-blue-600'
                                    }`}
                                    value={getBonusAmount(currentEmployee.id, selectedMonth)}
                                    onChange={(e) => handleScoreChange(currentEmployee.id, e.target.value)}
                                />
                             </div>

                             {/* Navigation Footer */}
                             <div className="w-full pt-4 flex items-center justify-between border-t border-gray-100 mt-auto">
                                <button 
                                    onClick={handlePrevCard}
                                    disabled={currentCardIndex === 0}
                                    className="p-3 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <span className="text-sm font-medium text-gray-500">
                                    {currentCardIndex + 1} / {eligibleEmployees.length}
                                </span>
                                <button 
                                    onClick={handleNextCard}
                                    disabled={currentCardIndex === eligibleEmployees.length - 1}
                                    className="p-3 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight size={24} />
                                </button>
                             </div>
                        </>
                    ) : (
                        <div className="text-gray-400 flex flex-col items-center">
                            <Search size={32} className="opacity-30 mb-2"/>
                            <p>No employees found.</p>
                        </div>
                    )}
                </div>
            )}

            {/* TABLE VIEW (Desktop & Mobile List) */}
            <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[400px] ${mobileView === 'card' ? 'hidden md:flex' : 'flex'}`}>
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white shadow-sm z-10">
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4 w-32 text-right">{t.score}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedInputEmployees.length > 0 ? (
                        paginatedInputEmployees.map(emp => (
                            <tr key={emp.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-4">
                                <div className="font-medium text-sm text-gray-900">{emp.firstName} {emp.lastName}</div>
                                <div className="text-xs text-gray-500">{emp.matricule}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <input 
                                    type="number" 
                                    min="0"
                                    placeholder="0"
                                    disabled={isInputDisabled}
                                    className={`w-24 pl-2 pr-2 py-1 border rounded text-right outline-none ${
                                        isInputDisabled
                                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200'
                                        : 'focus:ring-2 focus:ring-green-500/20 focus:border-green-500'
                                    }`}
                                    value={getBonusAmount(emp.id, selectedMonth)}
                                    onChange={(e) => handleScoreChange(emp.id, e.target.value)}
                                />
                            </td>
                            </tr>
                        ))
                        ) : (
                        <tr>
                            <td colSpan={2} className="px-6 py-12 text-center text-gray-400">
                                {isManager ? "No eligible employees in your team." : "No eligible employees found."}
                            </td>
                        </tr>
                        )}
                    </tbody>
                    </table>
                </div>

                {/* Input Pagination Footer */}
                {totalInputItems > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{t.rows_per_page}:</span>
                            <select 
                                value={inputItemsPerPage} 
                                onChange={(e) => { 
                                    setInputItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value)); 
                                    setInputCurrentPage(1); 
                                }}
                                className="bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none"
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value="all">{t.all}</option>
                            </select>
                            <span className="hidden sm:inline ml-4">
                                {(t.showing_range as string)
                                    .replace('{start}', String(startInputItem))
                                    .replace('{end}', String(endInputItem))
                                    .replace('{total}', String(totalInputItems))
                                }
                            </span>
                        </div>

                        {inputItemsPerPage !== 'all' && (
                            <div className="flex items-center gap-1">
                                <button 
                                    disabled={inputCurrentPage === 1}
                                    onClick={() => setInputCurrentPage(p => p - 1)}
                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-sm font-medium px-2">
                                    {inputCurrentPage} / {totalInputPages}
                                </span>
                                <button 
                                    disabled={inputCurrentPage === totalInputPages}
                                    onClick={() => setInputCurrentPage(p => p + 1)}
                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* HISTORY SECTION (Pivot Table) */}
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                 <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                    <History size={20} className="text-purple-600"/> {t.history}
                </h3>
                
                 <div className="relative">
                     <button 
                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
                        className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
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
                 
                 {/* Month Pagination Controls */}
                 <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1 border border-gray-200 rounded-lg bg-gray-50 p-1">
                         <button 
                            onClick={handleHistoryNext} // Go Older (p+1) - Left Arrow in UI means Go "Left" to Past
                            disabled={!hasOlderMonths}
                            className="p-1 hover:bg-white hover:shadow-sm rounded transition-all disabled:opacity-30"
                            title="Older months"
                         >
                             <ChevronLeft size={18} />
                         </button>
                         <span className="text-xs font-medium px-2 text-gray-600">
                             Months
                         </span>
                         <button 
                            onClick={handleHistoryPrev} // Go Newer (p-1) - Right Arrow in UI means Go "Right" to Future
                            disabled={!hasNewerMonths}
                            className="p-1 hover:bg-white hover:shadow-sm rounded transition-all disabled:opacity-30"
                            title="Newer months"
                         >
                             <ChevronRight size={18} />
                         </button>
                     </div>

                     <select 
                        value={historyMonthsToShow}
                        onChange={(e) => handleMonthsCountChange(Number(e.target.value))}
                        className="px-2 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none"
                    >
                        <option value={3}>3 Months</option>
                        <option value={6}>6 Months</option>
                        <option value={9}>9 Months</option>
                        <option value={12}>12 Months</option>
                    </select>
                 </div>
            </div>

            <div ref={historyRef} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                {/* Mobile History View (Paginated) */}
                <div className="grid grid-cols-1 gap-4 md:hidden p-4">
                    {paginatedEmployees.length > 0 ? (
                        paginatedEmployees.map(emp => (
                            <div key={emp.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="font-bold text-gray-900 mb-2">{emp.firstName} {emp.lastName}</h4>
                                <div className="space-y-1">
                                    {visibleMonths.map(month => {
                                        const amount = getBonusAmount(emp.id, month);
                                        if (!amount) return null;
                                        return (
                                            <div key={month} className="flex justify-between text-sm border-b border-gray-100 last:border-0 py-1">
                                                <span className="text-gray-500">{formatMonthHeader(month)}</span>
                                                <span className="font-bold text-green-600">{amount}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-gray-400 py-8">No history found.</div>
                    )}
                </div>

                {/* Desktop History View */}
                <div className="hidden md:block overflow-auto min-h-[300px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white shadow-sm z-10">
                            <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <th className="px-4 py-3 sticky left-0 bg-gray-50 z-20 border-r border-gray-200">Employee</th>
                                {visibleMonths.map(month => (
                                    <th key={month} className="px-4 py-3 text-center min-w-[100px] border-r border-gray-100 last:border-0">
                                        {formatMonthHeader(month)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedEmployees.length > 0 ? (
                                paginatedEmployees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3 sticky left-0 bg-white border-r border-gray-200 font-medium text-sm text-gray-900">
                                            {emp.firstName} {emp.lastName}
                                        </td>
                                        {visibleMonths.map(month => {
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
                                    <td colSpan={visibleMonths.length + 1} className="px-6 py-12 text-center text-gray-400">
                                        No history found matching filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                 {/* Pagination Footer */}
                {totalItems > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{t.rows_per_page}:</span>
                            <select 
                                value={itemsPerPage} 
                                onChange={(e) => { 
                                    setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value)); 
                                    setCurrentPage(1); 
                                }}
                                className="bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none"
                            >
                                <option value={10}>10</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value="all">{t.all}</option>
                            </select>
                            <span className="hidden sm:inline ml-4">
                                {(t.showing_range as string)
                                    .replace('{start}', String(startItem))
                                    .replace('{end}', String(endItem))
                                    .replace('{total}', String(totalItems))
                                }
                            </span>
                        </div>

                        {itemsPerPage !== 'all' && (
                            <div className="flex items-center gap-1">
                                <button 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-sm font-medium px-2">
                                    {currentPage} / {totalPages}
                                </span>
                                <button 
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
