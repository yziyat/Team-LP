
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppSettings, Bonus as BonusType, Employee, Team, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { Filter, Award, Search, History, Download, FileText, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
  
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchTerm, setSearchTerm] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  // History Filters
  const [historyStartMonth, setHistoryStartMonth] = useState('');
  const [historyEndMonth, setHistoryEndMonth] = useState('');
  const [historyPersonFilter, setHistoryPersonFilter] = useState('');
  
  // Pagination State for History
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

  // Helper to get formatted filename
  const getExportFilename = (prefix: string) => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
      const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
      return `${prefix}_${dateStr}_${timeStr}`;
  };

  // PIVOT TABLE LOGIC FOR HISTORY
  // 1. Get unique months
  let uniqueMonths = Array.from(new Set(bonuses.map(b => b.month))).sort().reverse();
  
  // 2. Filter months
  if (historyStartMonth || historyEndMonth) {
      uniqueMonths = uniqueMonths.filter(m => {
          if (historyStartMonth && m < historyStartMonth) return false;
          if (historyEndMonth && m > historyEndMonth) return false;
          return true;
      });
  } else {
      // Default: Show last 4 months if no specific range provided
      uniqueMonths = uniqueMonths.slice(0, 4);
  }

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

  // 4. Pagination Logic
  const totalItems = employeesWithBonuses.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);
  
  const paginatedEmployees = itemsPerPage === 'all' 
    ? employeesWithBonuses 
    : employeesWithBonuses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startItem = itemsPerPage === 'all' ? 1 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = itemsPerPage === 'all' ? totalItems : Math.min(currentPage * itemsPerPage, totalItems);

  // Export Logic
  const handleExport = async (type: 'pdf' | 'image') => {
      setIsExportMenuOpen(false);
      const filename = getExportFilename('bonus');
      
      if (type === 'pdf') {
          const doc = new jsPDF('landscape');
          doc.text("Bonus History", 14, 15);
          
          const columns = [
              { header: 'Employee', dataKey: 'name' },
              ...uniqueMonths.map(m => ({ header: m, dataKey: m }))
          ];

          const data = employeesWithBonuses.map(emp => {
              const row: any = { name: `${emp.firstName} ${emp.lastName}` };
              uniqueMonths.forEach(m => {
                  row[m] = getBonusAmount(emp.id, m);
              });
              return row;
          });

          autoTable(doc, {
              head: [columns.map(c => c.header)],
              body: data.map((row: any) => columns.map(c => row[c.dataKey])),
              startY: 20,
              styles: { fontSize: 10 },
              didParseCell: (data: any) => {
                   if (data.section === 'body' && data.column.index > 0) {
                        if (data.cell.raw) {
                             data.cell.styles.textColor = [22, 163, 74]; // green-600
                             data.cell.styles.fontStyle = 'bold';
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

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                {/* Logic: Show table if Admin (even with no team selected) OR if Manager */}
                {(!isManager && !selectedTeam) ? (
                     <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <Award size={48} className="opacity-30 text-blue-500 mb-2" />
                        <p>{t.select_team} (or see all below if configured)</p>
                        <p className="text-xs mt-2">Admins can see all eligible employees if no team is selected.</p>
                     </div>
                ) : null}

                {/* Actually, prompt said "Admins show all by default". So we show table always unless empty. */}
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
                                {isManager ? "No eligible employees in your team." : "No eligible employees found."}
                            </td>
                        </tr>
                        )}
                    </tbody>
                    </table>
                </div>
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

            <div ref={historyRef} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                {/* Mobile History View (Paginated) */}
                <div className="grid grid-cols-1 gap-4 md:hidden p-4">
                    {paginatedEmployees.length > 0 ? (
                        paginatedEmployees.map(emp => (
                            <div key={emp.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="font-bold text-gray-900 mb-2">{emp.firstName} {emp.lastName}</h4>
                                <div className="space-y-1">
                                    {uniqueMonths.map(month => {
                                        const amount = getBonusAmount(emp.id, month);
                                        if (!amount) return null;
                                        return (
                                            <div key={month} className="flex justify-between text-sm border-b border-gray-100 last:border-0 py-1">
                                                <span className="text-gray-500">{month}</span>
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
                                {uniqueMonths.map(month => (
                                    <th key={month} className="px-4 py-3 text-center min-w-[80px] border-r border-gray-100 last:border-0">{month}</th>
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