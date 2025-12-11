
import React, { useState, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, Filter, User, LogOut, ChevronLeft, ChevronRight, Calendar, Download, FileText, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { Employee, AppSettings, User as UserType } from '../types';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { TRANSLATIONS, formatDisplayDate } from '../constants';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EmployeeListProps {
  employees: Employee[];
  settings: AppSettings;
  currentUser: UserType;
  onAdd: (emp: Omit<Employee, 'id'>) => void;
  onUpdate: (id: number, emp: Partial<Employee>) => void;
  onDelete: (id: number) => void;
  notify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const EmployeeList: React.FC<EmployeeListProps> = ({ employees, settings, currentUser, onAdd, onUpdate, onDelete, notify }) => {
  const t = TRANSLATIONS[settings.language];
  const tableRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedExitEmployee, setSelectedExitEmployee] = useState<Employee | null>(null);
  const [exitDate, setExitDate] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    matricule: '',
    birthDate: '',
    category: '',
    assignment: '',
    isBonusEligible: false,
    entryDate: '' // New Field
  });

  const isAdmin = currentUser.role === 'admin';

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.matricule.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter ? emp.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  // Pagination Logic
  const totalItems = filteredEmployees.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);
  
  const paginatedEmployees = itemsPerPage === 'all' 
    ? filteredEmployees 
    : filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startItem = itemsPerPage === 'all' ? 1 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = itemsPerPage === 'all' ? totalItems : Math.min(currentPage * itemsPerPage, totalItems);


  const handleOpenModal = (emp?: Employee) => {
    if (!isAdmin) return; // Protection

    if (emp) {
      setEditingEmployee(emp);
      setFormData({
        firstName: emp.firstName,
        lastName: emp.lastName,
        matricule: emp.matricule,
        birthDate: emp.birthDate,
        category: emp.category,
        assignment: emp.assignment,
        isBonusEligible: emp.isBonusEligible || false,
        entryDate: emp.entryDate || ''
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        firstName: '',
        lastName: '',
        matricule: '',
        birthDate: '',
        category: '',
        assignment: '',
        isBonusEligible: false,
        entryDate: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenExitModal = (emp: Employee) => {
    if (!isAdmin) return;
    setSelectedExitEmployee(emp);
    setExitDate(emp.exitDate || '');
    setIsExitModalOpen(true);
  };

  const validateDates = (birthDate: string, entryDate: string, exitDate: string | null) => {
    const birth = new Date(birthDate);
    const entry = entryDate ? new Date(entryDate) : null;
    const exit = exitDate ? new Date(exitDate) : null;

    if (entry && entry <= birth) {
        notify(t.error_entry_before_birth, 'error');
        return false;
    }
    if (exit && exit <= birth) {
        notify(t.error_exit_before_birth, 'error');
        return false;
    }
    if (exit && entry && exit <= entry) {
        notify(t.error_exit_before_entry, 'error');
        return false;
    }
    return true;
  };

  const handleSaveExitDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedExitEmployee) {
      if (exitDate) {
         // Validate against employee's birth and entry date
         const isValid = validateDates(selectedExitEmployee.birthDate, selectedExitEmployee.entryDate || '', exitDate);
         if (!isValid) return;
      }
      
      onUpdate(selectedExitEmployee.id, { exitDate: exitDate || null });
      setIsExitModalOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    // Validate Dates
    const isValid = validateDates(formData.birthDate, formData.entryDate, null);
    if (!isValid) return;

    if (editingEmployee) {
      onUpdate(editingEmployee.id, formData);
    } else {
      onAdd(formData);
    }
    setIsModalOpen(false);
  };

  // Export Logic
  const handleExport = async (type: 'pdf' | 'excel' | 'image') => {
      setIsExportMenuOpen(false);
      const filename = `employees_${new Date().toISOString().slice(0, 10)}`;

      if (type === 'excel') {
          // EXCEL EXPORT (Using HTML Table approach for best formatting results without heavy libraries)
          
          let tableContent = `
            <html>
            <head>
            <meta charset="UTF-8">
            <style>
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
            </head>
            <body>
              <table>
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Category</th>
                    <th>Assignment</th>
                    <th>Entry Date</th>
                    <th>Exit Date</th>
                    <th>Bonus Eligible</th>
                  </tr>
                </thead>
                <tbody>
          `;

          filteredEmployees.forEach(e => {
            tableContent += `
              <tr>
                <td>${e.matricule}</td>
                <td>${e.firstName}</td>
                <td>${e.lastName}</td>
                <td>${e.category}</td>
                <td>${e.assignment}</td>
                <td>${e.entryDate || ''}</td>
                <td>${e.exitDate || ''}</td>
                <td>${e.isBonusEligible ? 'Yes' : 'No'}</td>
              </tr>
            `;
          });

          tableContent += `
                </tbody>
              </table>
            </body>
            </html>
          `;

          const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
          const link = document.createElement("a");
          if (link.download !== undefined) {
              const url = URL.createObjectURL(blob);
              link.setAttribute("href", url);
              link.setAttribute("download", `${filename}.xls`); // Using .xls for HTML/XML format compatibility
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }

      } else if (type === 'pdf') {
          const doc = new jsPDF();
          doc.text("Employee List", 14, 15);
          
          const columns = [
              { header: 'Matricule', dataKey: 'matricule' },
              { header: 'First Name', dataKey: 'firstName' },
              { header: 'Last Name', dataKey: 'lastName' },
              { header: 'Category', dataKey: 'category' },
              { header: 'Assignment', dataKey: 'assignment' },
              { header: 'Entry', dataKey: 'entryDate' },
              { header: 'Status', dataKey: 'status' }
          ];

          const data = filteredEmployees.map(e => ({
              matricule: e.matricule,
              firstName: e.firstName,
              lastName: e.lastName,
              category: e.category,
              assignment: e.assignment,
              entryDate: e.entryDate || '-',
              status: e.exitDate ? `Exit: ${e.exitDate}` : 'Active'
          }));

          autoTable(doc, {
              head: [columns.map(c => c.header)],
              body: data.map(row => columns.map(c => row[c.dataKey as keyof typeof row])),
              startY: 20,
              styles: { fontSize: 8 }
          });
          doc.save(`${filename}.pdf`);
      } else {
          // Image
          if (!tableRef.current) return;
          try {
              const clone = tableRef.current.cloneNode(true) as HTMLElement;
              clone.style.position = 'absolute';
              clone.style.top = '-9999px';
              clone.style.width = 'fit-content';
              clone.style.minWidth = '800px';
              clone.style.background = 'white';
              clone.style.zIndex = '9999';
              document.body.appendChild(clone);

              const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
              document.body.removeChild(clone);

              const link = document.createElement('a');
              link.href = canvas.toDataURL('image/png');
              link.download = `${filename}.png`;
              link.click();
          } catch(e) {
              notify('Export failed', 'error');
          }
      }
  };

  // Render Action Buttons
  const renderActions = (emp: Employee) => (
    isAdmin && (
      <div className="flex items-center justify-end gap-1">
        <button onClick={() => handleOpenExitModal(emp)} className="p-1.5 hover:bg-orange-50 text-orange-600 rounded-lg transition-colors" title={t.exit_management}>
          <LogOut size={16} />
        </button>
        <button onClick={() => handleOpenModal(emp)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
          <Edit2 size={16} />
        </button>
        <button onClick={() => { if(window.confirm(t.delete + '?')) onDelete(emp.id) }} className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors">
          <Trash2 size={16} />
        </button>
      </div>
    )
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.employees}</h2>
          <p className="text-gray-500">{settings.language === 'fr' ? 'Gérez votre personnel et leurs informations' : 'Manage your staff and their information'}</p>
        </div>
        <div className="flex gap-2">
            {/* Export Dropdown */}
            <div className="relative">
                <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
                className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm h-full"
                >
                <Download size={18} />
                <span className="hidden sm:inline">{t.export}</span>
                <ChevronDown size={14} />
                </button>
                {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-50">
                        <FileText size={14} /> {t.export_pdf}
                    </button>
                    <button onClick={() => handleExport('excel')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-50">
                        <FileText size={14} /> Excel (.xls)
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
            
            {isAdmin && (
              <Button onClick={() => handleOpenModal()} icon={Plus}>
              {t.new_employee}
              </Button>
            )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder={t.search} 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="md:w-64 relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <select 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-white"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">{t.filter_category}</option>
            {settings.categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
         {paginatedEmployees.length > 0 ? (
            paginatedEmployees.map(emp => (
                <div key={emp.id} className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 ${emp.exitDate ? 'bg-gray-50 opacity-75' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                         <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${emp.exitDate ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>
                                {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">{emp.firstName} {emp.lastName}</h3>
                                <div className="text-xs text-gray-500 font-mono">{emp.matricule}</div>
                            </div>
                        </div>
                        {emp.isBonusEligible && !emp.exitDate && (
                             <span className="text-[10px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Bonus</span>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-600 mb-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-gray-400">Category</span>
                            <span>{emp.category}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-gray-400">Assignment</span>
                            <span>{emp.assignment}</span>
                        </div>
                         <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-gray-400">Entry</span>
                            <span>{formatDisplayDate(emp.entryDate, settings.dateFormat)}</span>
                        </div>
                         <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-gray-400">Exit</span>
                            <span className={emp.exitDate ? "text-red-500 font-medium" : "text-gray-400"}>{emp.exitDate ? formatDisplayDate(emp.exitDate, settings.dateFormat) : '-'}</span>
                        </div>
                    </div>
                    
                    {isAdmin && (
                      <div className="border-t pt-3 flex justify-end">
                          {renderActions(emp)}
                      </div>
                    )}
                </div>
            ))
         ) : (
            <div className="text-center py-8 text-gray-400">No employees</div>
         )}
      </div>

      {/* Desktop Table View */}
      <div ref={tableRef} className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="px-6 py-4">Matricule</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Assignment</th>
                <th className="px-6 py-4">Entry Date</th>
                <th className="px-6 py-4">Status</th>
                {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEmployees.length > 0 ? (
                paginatedEmployees.map(emp => (
                  <tr key={emp.id} className={`hover:bg-gray-50/50 transition-colors group ${emp.exitDate ? 'bg-gray-50 opacity-60' : ''}`}>
                    <td className="px-6 py-3 font-mono text-xs text-gray-600">{emp.matricule}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${emp.exitDate ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-900">{emp.firstName} {emp.lastName}</div>
                          {emp.isBonusEligible && !emp.exitDate && (
                             <span className="text-[9px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">Bonus</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {emp.category}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-600">{emp.assignment}</td>
                     <td className="px-6 py-3 text-xs text-gray-600">
                      {formatDisplayDate(emp.entryDate, settings.dateFormat)}
                    </td>
                    <td className="px-6 py-3">
                       {emp.exitDate ? (
                         <div className="flex items-center gap-1 text-xs text-red-500 font-medium">
                           <LogOut size={12} />
                           {formatDisplayDate(emp.exitDate, settings.dateFormat)}
                         </div>
                       ) : (
                         <span className="text-xs text-green-600 font-medium">Active</span>
                       )}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-3 text-right">
                        {renderActions(emp)}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <User size={32} className="opacity-50" />
                      <p>No employees found</p>
                    </div>
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
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value="all">{t.all}</option>
                    </select>
                    <span className="ml-4">
                         {t.showing_range
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

      {/* Edit/Create Modal (Restricted) */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingEmployee ? t.edit : t.new_employee}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input required type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input required type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matricule</label>
              <input required type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                value={formData.matricule} onChange={e => setFormData({...formData, matricule: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Birth Date</label>
              <input required type="date" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
                value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="">Select...</option>
                {settings.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assignment</label>
              <select required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                value={formData.assignment} onChange={e => setFormData({...formData, assignment: e.target.value})}>
                <option value="">Select...</option>
                {settings.assignments.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.entry_date} (Optional)</label>
            <input type="date" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
              value={formData.entryDate} onChange={e => setFormData({...formData, entryDate: e.target.value})} />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              id="bonusEligible"
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              checked={formData.isBonusEligible}
              onChange={e => setFormData({...formData, isBonusEligible: e.target.checked})}
            />
            <label htmlFor="bonusEligible" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
              {t.bonus_eligible}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>{t.cancel}</Button>
            <Button type="submit">{t.save}</Button>
          </div>
        </form>
      </Modal>

      {/* Exit Date Modal (Restricted) */}
      <Modal
        isOpen={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
        title={t.exit_management}
        size="sm"
      >
        <form onSubmit={handleSaveExitDate} className="space-y-4">
          <p className="text-sm text-gray-600">
            {t.set_exit_date} for <strong>{selectedExitEmployee?.firstName} {selectedExitEmployee?.lastName}</strong>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.exit_date}</label>
            <input 
              type="date" 
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
              value={exitDate} 
              onChange={e => setExitDate(e.target.value)} 
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty to reactivate.</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
             <Button type="button" variant="ghost" onClick={() => setIsExitModalOpen(false)}>{t.cancel}</Button>
             <Button type="submit">{t.save}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
