
import React, { useState } from 'react';
import { AuditLogEntry, AppSettings } from '../types';
import { TRANSLATIONS, formatDisplayDate } from '../constants';
import { Search, ShieldAlert, Filter, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface AuditLogProps {
  logs: AuditLogEntry[];
  lang: AppSettings['language'];
}

export const AuditLog: React.FC<AuditLogProps> = ({ logs, lang }) => {
  const t = TRANSLATIONS[lang];
  
  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Extract unique values for dropdowns
  const uniqueActions = Array.from(new Set(logs.map(l => l.action))).sort();
  const uniqueUsers = Array.from(new Set(logs.map(l => l.user))).sort();

  const handleReset = () => {
    setSearchTerm('');
    setActionFilter('');
    setUserFilter('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const filteredLogs = logs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = 
      log.action.toLowerCase().includes(searchLower) ||
      log.details.toLowerCase().includes(searchLower) ||
      log.user.toLowerCase().includes(searchLower);

    const matchAction = !actionFilter || log.action === actionFilter;
    const matchUser = !userFilter || log.user === userFilter;

    let matchDate = true;
    if (startDate || endDate) {
      const logDate = new Date(log.timestamp).setHours(0,0,0,0);
      if (startDate) {
        matchDate = matchDate && logDate >= new Date(startDate).setHours(0,0,0,0);
      }
      if (endDate) {
        matchDate = matchDate && logDate <= new Date(endDate).setHours(0,0,0,0);
      }
    }

    return matchSearch && matchAction && matchUser && matchDate;
  });

  // Pagination Logic
  const totalItems = filteredLogs.length;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);
  
  const paginatedLogs = itemsPerPage === 'all' 
    ? filteredLogs 
    : filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const startItem = itemsPerPage === 'all' ? 1 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = itemsPerPage === 'all' ? totalItems : Math.min(currentPage * itemsPerPage, totalItems);

  // Helper for rendering date
  const renderDate = (isoStr: string) => {
      const d = new Date(isoStr);
      // Just hardcode a format for log time? or use settings.
      // Ideally we pass full settings object to get format.
      // But formatDisplayDate is generic. Let's use localestring.
      return d.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.audit_title}</h2>
          <p className="text-gray-500">{t.audit_subtitle}</p>
        </div>
        <button 
          onClick={handleReset}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <RotateCcw size={16} />
          {t.reset}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Text Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder={t.search} 
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
            </div>
            {/* Action Filter */}
            <select 
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
                <option value="">{t.filter_action} (All)</option>
                {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {/* User Filter */}
            <select 
                value={userFilter}
                onChange={(e) => { setUserFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
                <option value="">{t.filter_user} (All)</option>
                {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {/* Date Range */}
            <div className="flex items-center gap-2">
                <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                    className="w-full px-2 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none"
                    placeholder={t.start_date}
                />
                <span className="text-gray-400">-</span>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                    className="w-full px-2 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none"
                    placeholder={t.end_date}
                />
            </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
          {paginatedLogs.length > 0 ? (
              paginatedLogs.map(log => (
                  <div key={log.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-blue-600 uppercase">{log.action}</span>
                          <span className="text-xs text-gray-500">{renderDate(log.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-800 font-mono bg-gray-50 p-2 rounded mb-2 break-all">{log.details}</p>
                      <div className="text-xs text-right text-gray-500">
                          by <span className="font-medium text-gray-700">{log.user}</span>
                      </div>
                  </div>
              ))
          ) : (
              <div className="text-center py-8 text-gray-400">No logs found</div>
          )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="px-6 py-4">{t.date}</th>
                <th className="px-6 py-4">{t.user}</th>
                <th className="px-6 py-4">{t.action}</th>
                <th className="px-6 py-4">{t.details}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {renderDate(log.timestamp)}
                    </td>
                    <td className="px-6 py-4">
                       <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {log.user}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {log.details}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <ShieldAlert size={32} className="opacity-50" />
                      <p>No audit logs found</p>
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
    </div>
  );
};
