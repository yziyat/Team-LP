
import React, { useState, useMemo } from 'react';
import { Training as TrainingType, AppSettings, Team, User, Employee } from '../types';
import { TRANSLATIONS, formatDisplayDate } from '../constants';
import { GraduationCap, Plus, Edit2, Trash2, CheckCircle, ArrowRight, RotateCcw, Calendar, Users, List, Archive, CheckSquare, Square, ChevronLeft, ChevronRight, Download, ChevronDown, FileText, LayoutDashboard, Search, Filter } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

interface TrainingProps {
    trainings: TrainingType[];
    teams: Team[];
    employees: Employee[];
    currentUser: User;
    settings: AppSettings;
    onAdd: (t: Omit<TrainingType, 'id'>) => void;
    onUpdate: (id: number, data: Partial<TrainingType>) => void;
    onDelete: (id: number) => void;
    notify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const Training: React.FC<TrainingProps> = ({ trainings, teams, employees, currentUser, settings, onAdd, onUpdate, onDelete, notify }) => {
    const t = TRANSLATIONS[settings.language];
    const isAdmin = currentUser.role === 'admin';
    const isManager = currentUser.role === 'manager';

    const STATUS_ORDER: TrainingType['status'][] = ['planned', 'in_progress', 'validated', 'archived'];
    const [activeStatus, setActiveStatus] = useState<TrainingType['status']>('planned');
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    
    // Pagination State (Main List)
    const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Create/Edit Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTraining, setEditingTraining] = useState<TrainingType | null>(null);
    const [formData, setFormData] = useState<{
        title: string; description: string; startDate: string; endDate: string;
        sessionCount: number; targetTeamIds: number[]
    }>({
        title: '', description: '', startDate: '', endDate: '', sessionCount: 1, targetTeamIds: []
    });

    // Participants Modal (For Managers/Admins in In-Progress)
    const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
    const [selectedTrainingForParticipants, setSelectedTrainingForParticipants] = useState<TrainingType | null>(null);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
    
    // Grouping state for participants modal
    const [groupByTeam, setGroupByTeam] = useState(false);
    const [groupByCategory, setGroupByCategory] = useState(false);

    // Attendance Modal (For Admin in Validated)
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [selectedTrainingForAttendance, setSelectedTrainingForAttendance] = useState<TrainingType | null>(null);
    const [presentEmployeeIds, setPresentEmployeeIds] = useState<number[]>([]);

    // Archived/Details Modal
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailTraining, setDetailTraining] = useState<TrainingType | null>(null);

    // Deletion Confirmation State
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, trId: number | null }>({ isOpen: false, trId: null });

    // --- DASHBOARD STATE (Admin Only) ---
    const [isDashboardOpen, setIsDashboardOpen] = useState(false);
    const [dashStartDate, setDashStartDate] = useState(() => `${new Date().getFullYear()}-01-01`);
    const [dashEndDate, setDashEndDate] = useState(() => `${new Date().getFullYear()}-12-31`);
    const [dashSearch, setDashSearch] = useState('');
    const [dashTeamFilter, setDashTeamFilter] = useState('');
    const [dashItemsPerPage, setDashItemsPerPage] = useState<number | 'all'>(10);
    const [dashCurrentPage, setDashCurrentPage] = useState(1);


    // --- Filter Logic (Main List) ---
    const filteredTrainings = useMemo(() => {
        // Reset page on filter change
        if (currentPage !== 1) setCurrentPage(1);
        return trainings.filter(tr => tr.status === activeStatus);
    }, [trainings, activeStatus]);

    // --- Pagination Logic (Main List) ---
    const totalItems = filteredTrainings.length;
    const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);
    const paginatedTrainings = itemsPerPage === 'all' 
        ? filteredTrainings 
        : filteredTrainings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const startItem = itemsPerPage === 'all' ? 1 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = itemsPerPage === 'all' ? totalItems : Math.min(currentPage * itemsPerPage, totalItems);


    // --- Handlers for Create/Edit ---
    const handleOpenEditModal = (training?: TrainingType) => {
        if (training) {
            setEditingTraining(training);
            setFormData({
                title: training.title,
                description: training.description,
                startDate: training.startDate,
                endDate: training.endDate,
                sessionCount: training.sessionCount,
                targetTeamIds: training.targetTeamIds || []
            });
        } else {
            setEditingTraining(null);
            setFormData({
                title: '', description: '', startDate: '', endDate: '', sessionCount: 1, targetTeamIds: []
            });
        }
        setIsEditModalOpen(true);
    };

    const validateForm = () => {
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);

        if (start > end) {
            notify(settings.language === 'fr' ? 'La date de début doit être antérieure à la date de fin.' : 'Start date must be before end date.', 'error');
            return false;
        }

        if (formData.targetTeamIds.length === 0) {
             notify(settings.language === 'fr' ? 'Veuillez sélectionner au moins une cible.' : 'Please select at least one target.', 'error');
             return false;
        }

        return true;
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        const payload = {
            ...formData,
            sessionDates: [], // Removed specific dates requirement
            status: editingTraining ? editingTraining.status : 'planned' as const,
            participants: editingTraining ? editingTraining.participants : []
        };
        
        if (editingTraining) {
            onUpdate(editingTraining.id, payload);
        } else {
            onAdd(payload);
        }
        setIsEditModalOpen(false);
    };

    const toggleTargetTeam = (teamId: number) => {
        setFormData(prev => {
            if (teamId === 0) {
                const isAllSelected = prev.targetTeamIds.includes(0);
                return { ...prev, targetTeamIds: isAllSelected ? [] : [0] };
            } else {
                const newIds = prev.targetTeamIds.filter(id => id !== 0);
                const exists = newIds.includes(teamId);
                const updatedIds = exists ? newIds.filter(id => id !== teamId) : [...newIds, teamId];
                return { ...prev, targetTeamIds: updatedIds };
            }
        });
    };

    // --- Handlers for Transitions ---
    const advanceStatus = (e: React.MouseEvent, tr: TrainingType) => {
        e.stopPropagation();
        const nextStatus = {
            'planned': 'in_progress',
            'in_progress': 'validated',
            'validated': 'archived'
        }[tr.status] as TrainingType['status'];
        
        if (nextStatus) onUpdate(tr.id, { status: nextStatus });
    };

    const revertStatus = (e: React.MouseEvent, tr: TrainingType) => {
        e.stopPropagation();
        const prevStatus = {
            'in_progress': 'planned',
            'validated': 'in_progress',
            'archived': 'validated'
        }[tr.status] as TrainingType['status'];

        if (prevStatus) {
            const updates: Partial<TrainingType> = { status: prevStatus };
            // RESET participants if reverting to planned
            if (prevStatus === 'planned') {
                updates.participants = [];
            }
            onUpdate(tr.id, updates);
        }
    };

    // Robust Delete Handler - Opens MODAL
    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        e.preventDefault();
        setDeleteConfirmation({ isOpen: true, trId: id });
    };
    
    // Actually executes delete
    const executeDelete = () => {
        if (deleteConfirmation.trId !== null) {
            onDelete(deleteConfirmation.trId);
            setDeleteConfirmation({ isOpen: false, trId: null });
        }
    };

    // --- Tab Navigation Handlers ---
    const handleNextTab = () => {
        const idx = STATUS_ORDER.indexOf(activeStatus);
        if (idx < STATUS_ORDER.length - 1) setActiveStatus(STATUS_ORDER[idx + 1]);
    };

    const handlePrevTab = () => {
        const idx = STATUS_ORDER.indexOf(activeStatus);
        if (idx > 0) setActiveStatus(STATUS_ORDER[idx - 1]);
    };

    // --- Handlers for Participants ---
    const handleOpenParticipantsModal = (e: React.MouseEvent, tr: TrainingType) => {
        e.stopPropagation();
        setSelectedTrainingForParticipants(tr);
        setSelectedEmployeeIds(tr.participants.map(p => p.employeeId));
        setIsParticipantsModalOpen(true);
    };

    const toggleParticipant = (empId: number) => {
        setSelectedEmployeeIds(prev => 
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    };

    const saveParticipants = () => {
        if (!selectedTrainingForParticipants) return;
        const newParticipants = selectedEmployeeIds.map(empId => {
            // Try to find existing participant entry to preserve 'present' status if already set
            const existing = selectedTrainingForParticipants.participants.find(p => p.employeeId === empId);
            return { employeeId: empId, present: existing ? existing.present : false };
        });
        onUpdate(selectedTrainingForParticipants.id, { participants: newParticipants });
        setIsParticipantsModalOpen(false);
    };

    const getEligibleEmployees = () => {
        if (!selectedTrainingForParticipants) return [];
        const targetIds = selectedTrainingForParticipants.targetTeamIds;
        const targetsAll = targetIds.includes(0);
        
        return employees.filter(emp => {
            if (!targetsAll && (!emp.teamId || !targetIds.includes(emp.teamId))) return false;
            if (isManager && !isAdmin) {
                const managedTeam = teams.find(t => t.leaderId === currentUser.employeeId);
                if (!managedTeam || emp.teamId !== managedTeam.id) return false;
            }
            return !emp.exitDate;
        });
    };

    const getGroupedAndSortedEmployees = () => {
        const base = getEligibleEmployees();
        
        // Sorting always by Alphabetical Name as base
        return [...base].sort((a, b) => {
            if (groupByCategory && a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            if (groupByTeam) {
                const teamA = teams.find(t => t.id === a.teamId)?.name || 'Sans équipe';
                const teamB = teams.find(t => t.id === b.teamId)?.name || 'Sans équipe';
                if (teamA !== teamB) return teamA.localeCompare(teamB);
            }
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        });
    };

    // --- Handlers for Attendance ---
    const handleOpenAttendanceModal = (e: React.MouseEvent, tr: TrainingType) => {
        e.stopPropagation();
        setSelectedTrainingForAttendance(tr);
        setPresentEmployeeIds(tr.participants.filter(p => p.present).map(p => p.employeeId));
        setIsAttendanceModalOpen(true);
    };

    const togglePresence = (empId: number) => {
        setPresentEmployeeIds(prev => 
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    };

    const saveAttendance = () => {
        if (!selectedTrainingForAttendance) return;
        const updatedParticipants = selectedTrainingForAttendance.participants.map(p => ({
            ...p,
            present: presentEmployeeIds.includes(p.employeeId)
        }));
        onUpdate(selectedTrainingForAttendance.id, { participants: updatedParticipants });
        setIsAttendanceModalOpen(false);
    };
    
    // --- Archived Details ---
    const handleTrainingClick = (e: React.MouseEvent, tr: TrainingType) => {
        // Prevent opening modal if clicking on a button or interactive element
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a')) {
            return;
        }

        if (tr.status === 'archived') {
            setDetailTraining(tr);
            setIsDetailModalOpen(true);
        }
    };

    const showParticipantsDetails = (e: React.MouseEvent, tr: TrainingType) => {
        e.stopPropagation();
        setDetailTraining(tr);
        setIsDetailModalOpen(true);
    };

    const renderStatusBadge = (status: string) => {
        const styles = {
            planned: "bg-blue-100 text-blue-700",
            in_progress: "bg-orange-100 text-orange-700",
            validated: "bg-green-100 text-green-700",
            archived: "bg-gray-100 text-gray-700"
        }[status] || "bg-gray-100";
        const labelKey = `status_${status}` as keyof typeof t;
        return <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${styles}`}>{t[labelKey] || status}</span>
    };

    // Helper for Pluralization
    const formatLabel = (count: number, label: string) => {
        if (count > 1) return `${count} ${label}`;
        const singular = label.endsWith('s') ? label.slice(0, -1) : label;
        return `${count} ${singular}`;
    };

    // --- DASHBOARD LOGIC (Admin) ---
    const filteredArchivedTrainings = useMemo(() => {
        if (!isAdmin) return [];
        return trainings.filter(t => {
            if (t.status !== 'archived') return false;

            // Date Range
            const tStart = new Date(t.startDate);
            const tEnd = new Date(t.endDate);
            const fStart = dashStartDate ? new Date(dashStartDate) : null;
            const fEnd = dashEndDate ? new Date(dashEndDate) : null;
            
            // Check intersection or simple boundary
            if (fStart && tEnd < fStart) return false;
            if (fEnd && tStart > fEnd) return false;

            // Team Filter
            if (dashTeamFilter) {
                const teamId = Number(dashTeamFilter);
                if (!t.targetTeamIds.includes(teamId) && !t.targetTeamIds.includes(0)) return false;
            }

            // Employee Search (Beneficiaries only)
            if (dashSearch) {
                const searchLower = dashSearch.toLowerCase();
                const hasParticipant = t.participants.some(p => {
                    if (!p.present) return false;
                    const emp = employees.find(e => e.id === p.employeeId);
                    if (!emp) return false;
                    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
                    return fullName.includes(searchLower);
                });
                if (!hasParticipant) return false;
            }

            return true;
        });
    }, [trainings, isAdmin, dashStartDate, dashEndDate, dashTeamFilter, dashSearch, employees]);

    // Dashboard Pagination
    const totalDashItems = filteredArchivedTrainings.length;
    const totalDashPages = dashItemsPerPage === 'all' ? 1 : Math.ceil(totalDashItems / dashItemsPerPage);
    const paginatedDashTrainings = dashItemsPerPage === 'all'
        ? filteredArchivedTrainings
        : filteredArchivedTrainings.slice((dashCurrentPage - 1) * dashItemsPerPage, dashCurrentPage * dashItemsPerPage);
    
    const startDashItem = dashItemsPerPage === 'all' ? 1 : (dashCurrentPage - 1) * dashItemsPerPage + 1;
    const endDashItem = dashItemsPerPage === 'all' ? totalDashItems : Math.min(dashCurrentPage * dashItemsPerPage, totalDashItems);


    // --- Excel Exports ---
    const handleExport = () => {
        setIsExportMenuOpen(false);
        const filename = `training_${activeStatus}_${new Date().toISOString().slice(0, 10)}`;
        generateExcel(filteredTrainings, filename, activeStatus);
    };

    const handleDashboardExport = () => {
        const filename = `training_dashboard_${new Date().toISOString().slice(0, 10)}`;
        generateExcel(filteredArchivedTrainings, filename, 'Dashboard');
    };

    const generateExcel = (data: TrainingType[], filename: string, titleSuffix: string) => {
        let tableContent = `
            <html>
            <head>
            <meta charset="UTF-8">
            <style>
              table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
            </head>
            <body>
              <h3>${t.training} - ${titleSuffix}</h3>
              <table>
                <thead>
                  <tr>
                    <th>${t.training_title}</th>
                    <th>${t.start_date}</th>
                    <th>${t.end_date}</th>
                    <th>${t.training_sessions}</th>
                    <th>Count</th>
                    <th>Present</th>
                    <th>Teams</th>
                    <th>${t.beneficiaries || 'Beneficiaries'}</th>
                  </tr>
                </thead>
                <tbody>
        `;

        data.forEach(tr => {
            const participantCount = tr.participants.length;
            const presentCount = tr.participants.filter(p => p.present).length;
            const targetAll = tr.targetTeamIds.includes(0);
            const teamNames = targetAll 
                ? (settings.language === 'fr' ? 'Toutes les équipes' : 'All Teams') 
                : tr.targetTeamIds.map(tid => teams.find(t => t.id === tid)?.name || '').join(', ');
            
            // Generate list of names
            const names = tr.participants
                .filter(p => p.present || activeStatus !== 'archived') // Show all if not archived, only present if archived
                .map(p => {
                    const e = employees.find(emp => emp.id === p.employeeId);
                    return e ? `${e.firstName} ${e.lastName}` : '';
                })
                .filter(n => n !== '')
                .join(', ');

            tableContent += `
              <tr>
                <td>${tr.title}</td>
                <td>${formatDisplayDate(tr.startDate, settings.dateFormat)}</td>
                <td>${formatDisplayDate(tr.endDate, settings.dateFormat)}</td>
                <td>${tr.sessionCount}</td>
                <td>${participantCount}</td>
                <td>${presentCount}</td>
                <td>${teamNames}</td>
                <td>${names}</td>
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
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    let lastParticipantGroup = "";

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">{t.training}</h2>
                    <p className="text-gray-500">{settings.language === 'fr' ? 'Gérez les plans de formation' : 'Manage training plans'}</p>
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
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <button onClick={handleExport} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                    <FileText size={14} /> Excel (.xls)
                                </button>
                            </div>
                        )}
                        {isExportMenuOpen && (
                            <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)}></div>
                        )}
                    </div>

                    {isAdmin && activeStatus === 'planned' && (
                        <Button onClick={() => handleOpenEditModal()} icon={Plus}>
                            {t.create}
                        </Button>
                    )}
                </div>
            </div>

            {/* Mobile Tab Navigation */}
            <div className="md:hidden flex items-center justify-between bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                <button onClick={handlePrevTab} disabled={activeStatus === 'planned'} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={24} /></button>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-400 uppercase font-semibold">{settings.language === 'fr' ? 'Étape' : 'Stage'}</span>
                    <span className="text-lg font-bold text-blue-600">{t[`status_${activeStatus}` as keyof typeof t]}</span>
                </div>
                <button onClick={handleNextTab} disabled={activeStatus === 'archived'} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={24} /></button>
            </div>

            {/* Desktop Sub-Navigation */}
            <div className="hidden md:flex overflow-x-auto gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm scrollbar-hide">
                {STATUS_ORDER.map(status => {
                     const labelKey = `status_${status}` as keyof typeof t;
                     return (
                        <button key={status} onClick={() => setActiveStatus(status)} className={`flex-1 min-w-[100px] whitespace-nowrap py-2 px-4 rounded-lg text-sm font-medium transition-all ${activeStatus === status ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>{t[labelKey]}</button>
                     );
                })}
            </div>

            {/* Main Content List */}
            <div className="grid grid-cols-1 gap-4">
                {paginatedTrainings.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed text-gray-400">
                        <GraduationCap size={48} className="mx-auto mb-3 opacity-20" />
                        <p>{settings.language === 'fr' ? 'Aucune formation dans cette étape' : 'No training in this stage'}</p>
                    </div>
                )}
                
                {paginatedTrainings.map(tr => (
                    <div key={tr.id} onClick={(e) => handleTrainingClick(e, tr)} className={`bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${tr.status === 'archived' ? 'cursor-pointer hover:border-blue-300' : ''}`}>
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-1 space-y-2 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    {renderStatusBadge(tr.status)}
                                    <h3 className="text-lg font-bold text-gray-900 break-words">{tr.title}</h3>
                                </div>
                                <p className="text-gray-600 text-sm line-clamp-2 break-words">{tr.description}</p>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-2">
                                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded whitespace-nowrap"><Calendar size={14} /><span>{formatDisplayDate(tr.startDate, settings.dateFormat)} → {formatDisplayDate(tr.endDate, settings.dateFormat)}</span></div>
                                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded whitespace-nowrap"><List size={14} /><span>{formatLabel(tr.sessionCount, t.training_sessions)}</span></div>
                                    
                                    {/* Selectable Participants Badge */}
                                    {tr.status !== 'planned' && (
                                        <button 
                                            onClick={(e) => showParticipantsDetails(e, tr)}
                                            className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded whitespace-nowrap border border-blue-100 hover:bg-blue-100 transition-colors shadow-sm"
                                        >
                                            <Users size={14} />
                                            <span className="font-semibold">
                                                {tr.status === 'archived'
                                                    ? formatLabel(tr.participants.filter(p => p.present).length, t.attendees || 'Présents')
                                                    : formatLabel(tr.participants.length, t.training_participants)
                                                }
                                            </span>
                                        </button>
                                    )}

                                    <div className="flex flex-wrap gap-1 items-center">
                                        <span className="font-semibold">{t.training_target}:</span>
                                        {tr.targetTeamIds.includes(0) ? <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap font-bold">{settings.language === 'fr' ? 'Toutes' : 'All'}</span> : tr.targetTeamIds.map(tid => { const tm = teams.find(t => t.id === tid); return tm ? <span key={tid} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">{tm.name}</span> : null; })}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-row md:flex-col justify-end md:justify-center gap-2 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 border-gray-100 shrink-0">
                                {activeStatus === 'planned' && isAdmin && (
                                    <>
                                        <Button size="sm" onClick={(e) => advanceStatus(e, tr)} icon={ArrowRight} className="bg-green-600 hover:bg-green-700">{t.validate_step}</Button>
                                        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleOpenEditModal(tr); }} icon={Edit2}>{t.edit}</Button>
                                        <Button size="sm" variant="danger" onClick={(e) => handleDeleteClick(e, tr.id)} icon={Trash2}>{t.delete}</Button>
                                    </>
                                )}
                                {activeStatus === 'in_progress' && (
                                    <>
                                        <Button size="sm" variant="secondary" onClick={(e) => handleOpenParticipantsModal(e, tr)} icon={Users}>{t.manage_participants}</Button>
                                        {isAdmin && (
                                            <>
                                                <Button size="sm" onClick={(e) => advanceStatus(e, tr)} icon={CheckCircle}>{t.validate_step}</Button>
                                                <Button size="sm" variant="ghost" onClick={(e) => revertStatus(e, tr)} icon={RotateCcw} className="text-orange-600">{t.back_step}</Button>
                                            </>
                                        )}
                                    </>
                                )}
                                {activeStatus === 'validated' && isAdmin && (
                                    <>
                                        <Button size="sm" variant="secondary" onClick={(e) => handleOpenAttendanceModal(e, tr)} icon={CheckSquare}>{t.mark_attendance}</Button>
                                        <Button size="sm" onClick={(e) => advanceStatus(e, tr)} icon={Archive} className="bg-gray-700 hover:bg-gray-800">{t.archive}</Button>
                                        <Button size="sm" variant="ghost" onClick={(e) => revertStatus(e, tr)} icon={RotateCcw} className="text-orange-600">{t.back_step}</Button>
                                    </>
                                )}
                                {activeStatus === 'archived' && isAdmin && (
                                    <Button size="sm" variant="ghost" onClick={(e) => revertStatus(e, tr)} icon={RotateCcw}>{t.back_step}</Button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination Footer (Main) */}
            {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 w-full sm:w-auto justify-between sm:justify-start">
                        <div className="flex items-center gap-2">
                            <span>{t.rows_per_page}:</span>
                            <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCurrentPage(1); }} className="bg-gray-50 border border-gray-300 rounded px-2 py-1 focus:outline-none">
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value="all">{t.all}</option>
                            </select>
                        </div>
                        <span className="ml-4 text-xs sm:text-sm">{(t.showing_range as string).replace('{start}', String(startItem)).replace('{end}', String(endItem)).replace('{total}', String(totalItems))}</span>
                    </div>
                    {itemsPerPage !== 'all' && (
                        <div className="flex items-center gap-1">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded hover:bg-gray-100 border border-gray-200 disabled:opacity-50"><ChevronLeft size={16} /></button>
                            <span className="text-sm font-medium px-3">{currentPage} / {totalPages}</span>
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded hover:bg-gray-100 border border-gray-200 disabled:opacity-50"><ChevronRight size={16} /></button>
                        </div>
                    )}
                </div>
            )}

            {/* --- ADMIN DASHBOARD SECTION --- */}
            {isAdmin && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                    <button 
                        onClick={() => setIsDashboardOpen(!isDashboardOpen)}
                        className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <LayoutDashboard size={20} />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-gray-800">{t.training_dashboard || 'Training Dashboard'}</h3>
                                <p className="text-xs text-gray-500">{t.training_history || 'View history and beneficiaries'}</p>
                            </div>
                        </div>
                        <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${isDashboardOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDashboardOpen && (
                        <div className="mt-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-4 duration-300">
                            {/* Dashboard Filters */}
                            <div className="flex flex-wrap gap-4 mb-6">
                                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                    <input type="date" className="bg-transparent text-sm p-1 outline-none" value={dashStartDate} onChange={e => {setDashStartDate(e.target.value); setDashCurrentPage(1);}} />
                                    <span className="text-gray-400">-</span>
                                    <input type="date" className="bg-transparent text-sm p-1 outline-none" value={dashEndDate} onChange={e => {setDashEndDate(e.target.value); setDashCurrentPage(1);}} />
                                </div>
                                <select 
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                                    value={dashTeamFilter}
                                    onChange={e => {setDashTeamFilter(e.target.value); setDashCurrentPage(1);}}
                                >
                                    <option value="">{t.filter_team}</option>
                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <input 
                                    type="text" 
                                    placeholder={t.filter_employee}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1"
                                    value={dashSearch}
                                    onChange={e => {setDashSearch(e.target.value); setDashCurrentPage(1);}}
                                />
                                <Button size="sm" variant="secondary" onClick={handleDashboardExport} icon={FileText}>
                                    Excel
                                </Button>
                            </div>

                            {/* Mobile Dashboard View (Cards) */}
                            <div className="md:hidden grid grid-cols-1 gap-4">
                                {paginatedDashTrainings.length === 0 && <div className="text-center text-gray-400 py-8">No data found.</div>}
                                {paginatedDashTrainings.map(tr => {
                                    const beneficiaryNames = tr.participants
                                        .filter(p => p.present)
                                        .map(p => {
                                            const emp = employees.find(e => e.id === p.employeeId);
                                            return emp ? `${emp.firstName} ${emp.lastName}` : null;
                                        })
                                        .filter(Boolean)
                                        .join(', ');
                                    
                                    const teamNames = tr.targetTeamIds.includes(0) 
                                                ? (settings.language === 'fr' ? 'Toutes' : 'All') 
                                                : tr.targetTeamIds.map(tid => teams.find(t => t.id === tid)?.name).filter(Boolean).join(', ');

                                    return (
                                        <div key={tr.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                            <h4 className="font-bold text-gray-900 mb-2">{tr.title}</h4>
                                            <div className="text-xs text-gray-500 mb-2">{formatDisplayDate(tr.startDate, settings.dateFormat)} → {formatDisplayDate(tr.endDate, settings.dateFormat)}</div>
                                            <div className="text-xs mb-2"><strong>{settings.language === 'fr' ? 'Cible(s)' : 'Target(s)'}:</strong> {teamNames}</div>
                                            <div className="text-xs bg-gray-50 p-2 rounded">
                                                <strong>{t.beneficiaries || 'Beneficiaries'}:</strong> {beneficiaryNames || 'None'}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Desktop Dashboard Table */}
                            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3">{t.training_title}</th>
                                            <th className="px-4 py-3">{t.date}</th>
                                            <th className="px-4 py-3">{settings.language === 'fr' ? 'Cible(s)' : 'Target(s)'}</th>
                                            <th className="px-4 py-3">{t.beneficiaries || 'Beneficiaries'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedDashTrainings.length === 0 && (
                                            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No data found.</td></tr>
                                        )}
                                        {paginatedDashTrainings.map(tr => {
                                            // Get Beneficiaries (Present Only)
                                            const beneficiaryNames = tr.participants
                                                .filter(p => p.present)
                                                .map(p => {
                                                    const emp = employees.find(e => e.id === p.employeeId);
                                                    return emp ? `${emp.firstName} ${emp.lastName}` : null;
                                                })
                                                .filter(Boolean)
                                                .join(', ');

                                            const teamNames = tr.targetTeamIds.includes(0) 
                                                ? (settings.language === 'fr' ? 'Toutes' : 'All') 
                                                : tr.targetTeamIds.map(tid => teams.find(t => t.id === tid)?.name).filter(Boolean).join(', ');

                                            return (
                                                <tr key={tr.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium text-gray-900">{tr.title}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                                                        {formatDisplayDate(tr.startDate, settings.dateFormat)} <span className="text-gray-300">→</span> {formatDisplayDate(tr.endDate, settings.dateFormat)}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600 text-xs">{teamNames}</td>
                                                    <td className="px-4 py-3 text-gray-600 text-xs">
                                                        {beneficiaryNames || <span className="text-gray-300 italic">None</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Dashboard Pagination */}
                            {totalDashItems > 0 && (
                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>Show:</span>
                                        <select value={dashItemsPerPage} onChange={(e) => { setDashItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value)); setDashCurrentPage(1); }} className="border rounded p-1">
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value="all">{t.all}</option>
                                        </select>
                                        <span>{(t.showing_range as string).replace('{start}', String(startDashItem)).replace('{end}', String(endDashItem)).replace('{total}', String(totalDashItems))}</span>
                                    </div>
                                    {dashItemsPerPage !== 'all' && (
                                        <div className="flex items-center gap-1">
                                            <button disabled={dashCurrentPage === 1} onClick={() => setDashCurrentPage(p => p - 1)} className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
                                            <span className="text-xs px-2">{dashCurrentPage} / {totalDashPages}</span>
                                            <button disabled={dashCurrentPage === totalDashPages} onClick={() => setDashCurrentPage(p => p + 1)} className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={16} /></button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* CREATE/EDIT MODAL */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={editingTraining ? t.edit : t.create}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.training_title}</label>
                        <input required type="text" className="w-full px-3 py-2 border rounded-lg" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.details}</label>
                        <textarea className="w-full px-3 py-2 border rounded-lg h-24" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.start_date}</label>
                            <input required type="date" className="w-full px-3 py-2 border rounded-lg" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.end_date}</label>
                            <input required type="date" className="w-full px-3 py-2 border rounded-lg" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t.training_sessions}</label>
                        <input type="number" min="1" max="20" className="w-full px-3 py-2 border rounded-lg" value={formData.sessionCount} onChange={e => setFormData({...formData, sessionCount: Number(e.target.value)})} />
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-2">{t.teams}</label>
                         <div className="flex flex-wrap gap-2">
                             <button type="button" onClick={() => toggleTargetTeam(0)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${formData.targetTeamIds.includes(0) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{settings.language === 'fr' ? 'Toutes les équipes' : 'All Teams'}</button>
                             {teams.map(team => (
                                 <button type="button" key={team.id} onClick={() => toggleTargetTeam(team.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${formData.targetTeamIds.includes(team.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{team.name}</button>
                             ))}
                         </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>{t.cancel}</Button>
                        <Button type="submit">{t.save}</Button>
                    </div>
                </form>
            </Modal>

            {/* PARTICIPANTS MODAL */}
            <Modal isOpen={isParticipantsModalOpen} onClose={() => setIsParticipantsModalOpen(false)} title={t.manage_participants} size="lg">
                 <div className="space-y-4">
                     <p className="text-sm text-gray-500">{settings.language === 'fr' ? 'Sélectionnez les employés qui participeront à cette formation.' : 'Select employees who will participate in this training.'}</p>
                     
                     <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                         <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                             <input 
                                type="checkbox" 
                                checked={groupByTeam} 
                                onChange={(e) => setGroupByTeam(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                             />
                             {t.group_by_team}
                         </label>
                         <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                             <input 
                                type="checkbox" 
                                checked={groupByCategory} 
                                onChange={(e) => setGroupByCategory(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                             />
                             {t.group_by_category}
                         </label>
                     </div>

                     <div className="max-h-[400px] overflow-y-auto border rounded-lg p-2 bg-gray-50">
                         {getEligibleEmployees().length === 0 ? (
                             <p className="text-center text-gray-400 py-4">No eligible employees found for target teams.</p>
                         ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {getGroupedAndSortedEmployees().map((emp) => {
                                    const teamName = teams.find(t => t.id === emp.teamId)?.name || 'Sans équipe';
                                    const groupLabel = (groupByCategory ? emp.category : "") + (groupByCategory && groupByTeam ? " - " : "") + (groupByTeam ? teamName : "");
                                    
                                    const showHeader = (groupByCategory || groupByTeam) && groupLabel !== lastParticipantGroup;
                                    if (showHeader) lastParticipantGroup = groupLabel;

                                    return (
                                        <React.Fragment key={emp.id}>
                                            {showHeader && (
                                                <div className="col-span-1 sm:col-span-2 mt-4 mb-1 first:mt-0">
                                                    <span className="text-[10px] uppercase tracking-widest font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                        {groupLabel}
                                                    </span>
                                                </div>
                                            )}
                                            <div onClick={() => toggleParticipant(emp.id)} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedEmployeeIds.includes(emp.id) ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                                                <div className={`text-blue-600 ${selectedEmployeeIds.includes(emp.id) ? 'opacity-100' : 'opacity-20'}`}>{selectedEmployeeIds.includes(emp.id) ? <CheckSquare size={20} /> : <Square size={20} />}</div>
                                                <div><p className="font-medium text-sm text-gray-900">{emp.firstName} {emp.lastName}</p><p className="text-xs text-gray-500">{emp.matricule}</p></div>
                                            </div>
                                        </React.Fragment>
                                    )
                                })}
                                {/* Clear tracker for future renders */}
                                {(() => { lastParticipantGroup = ""; return null; })()}
                            </div>
                         )}
                     </div>
                     <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={() => setIsParticipantsModalOpen(false)}>{t.cancel}</Button>
                        <Button onClick={saveParticipants}>{t.save}</Button>
                    </div>
                 </div>
            </Modal>

            {/* ATTENDANCE MODAL */}
            <Modal isOpen={isAttendanceModalOpen} onClose={() => setIsAttendanceModalOpen(false)} title={t.mark_attendance} size="lg">
                <div className="space-y-4">
                     <p className="text-sm text-gray-500">{settings.language === 'fr' ? 'Cochez les employés qui ont complété la formation.' : 'Check employees who completed the training.'}</p>
                     <div className="max-h-[400px] overflow-y-auto border rounded-lg p-2 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-2">
                         {selectedTrainingForAttendance?.participants.length === 0 ? (
                             <p className="col-span-2 text-center text-gray-400 py-4">No participants registered.</p>
                         ) : (
                             selectedTrainingForAttendance?.participants.map(p => {
                                 const emp = employees.find(e => e.id === p.employeeId);
                                 if (!emp) return null;
                                 return (
                                    <div key={emp.id} onClick={() => togglePresence(emp.id)} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${presentEmployeeIds.includes(emp.id) ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                                        <div className={`text-green-600 ${presentEmployeeIds.includes(emp.id) ? 'opacity-100' : 'opacity-20'}`}>{presentEmployeeIds.includes(emp.id) ? <CheckSquare size={20} /> : <Square size={20} />}</div>
                                        <div><p className="font-medium text-sm text-gray-900">{emp.firstName} {emp.lastName}</p><p className="text-xs text-gray-500">{emp.matricule}</p></div>
                                    </div>
                                 )
                             })
                         )}
                     </div>
                     <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={() => setIsAttendanceModalOpen(false)}>{t.cancel}</Button>
                        <Button onClick={saveAttendance}>{t.save}</Button>
                    </div>
                </div>
            </Modal>

            {/* DETAIL POPUP MODAL */}
            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={detailTraining ? detailTraining.title : 'Details'} size="lg">
                {detailTraining && (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2 border-b pb-4">
                            <div className="flex items-center gap-2">
                                {renderStatusBadge(detailTraining.status)}
                                <h3 className="font-bold text-gray-900">{detailTraining.title}</h3>
                            </div>
                            <p className="text-sm text-gray-600">{detailTraining.description}</p>
                            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><Calendar size={14} /><span>{formatDisplayDate(detailTraining.startDate, settings.dateFormat)} → {formatDisplayDate(detailTraining.endDate, settings.dateFormat)}</span></div>
                                <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><List size={14} /><span>{formatLabel(detailTraining.sessionCount, t.training_sessions)}</span></div>
                                <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><Users size={14} /><span>{formatLabel(detailTraining.participants.length, t.training_participants)}</span></div>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-gray-700 uppercase">{t.training_attendance}</h4>
                            {detailTraining.status === 'archived' && (
                                <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-100">
                                    {formatLabel(detailTraining.participants.filter(p => p.present).length, t.attendees || 'Présents')}
                                </span>
                            )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto border rounded-lg p-2 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-2">
                             {detailTraining.participants.length === 0 ? (
                                 <p className="col-span-2 text-center py-8 text-gray-400 italic">Aucun participant sélectionné.</p>
                             ) : (
                                 detailTraining.participants.map(p => {
                                    const emp = employees.find(e => e.id === p.employeeId);
                                    if (!emp) return null;
                                    const showAttendance = detailTraining.status === 'archived' || detailTraining.status === 'validated';
                                    return (
                                        <div key={emp.id} className={`flex items-center gap-3 p-3 rounded-lg border ${showAttendance && p.present ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                                            <div className={`text-green-600 ${(showAttendance && p.present) || !showAttendance ? 'opacity-100' : 'opacity-20'}`}>
                                                {((showAttendance && p.present) || !showAttendance) ? <CheckSquare size={20} /> : <Square size={20} />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-gray-900">{emp.firstName} {emp.lastName}</p>
                                                <p className="text-xs text-gray-500">{emp.matricule} • {emp.category}</p>
                                            </div>
                                        </div>
                                    )
                                 })
                             )}
                        </div>
                         <div className="flex justify-end pt-4 border-t">
                            <Button type="button" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Deletion Confirmation Modal */}
            <Modal
                isOpen={deleteConfirmation.isOpen}
                onClose={() => setDeleteConfirmation({ isOpen: false, trId: null })}
                title={t.delete + '?'}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        {settings.language === 'fr' 
                            ? 'Êtes-vous sûr de vouloir supprimer cette formation ?' 
                            : 'Are you sure you want to delete this training?'}
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setDeleteConfirmation({ isOpen: false, trId: null })}>
                            {t.cancel}
                        </Button>
                        <Button variant="danger" onClick={executeDelete}>
                            {t.delete}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
