
import React, { useState, useMemo } from 'react';
import { Plus, Trash2, CheckSquare, Square, Globe, Briefcase, Users as UsersIcon, Clock, Edit2, CalendarOff, CalendarDays, List, MapPin, Info, ChevronRight, Hash } from 'lucide-react';
import { AppSettings, Team, Employee, Shift, Holiday, AbsenceType, User } from '../types';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { TRANSLATIONS, formatDisplayDate } from '../constants';

interface SettingsProps {
  currentUser: User;
  settings: AppSettings;
  teams: Team[];
  employees: Employee[];
  onUpdateSettings: (key: keyof AppSettings, value: any) => void;
  onAddTeam: (team: Omit<Team, 'id'>) => void;
  onUpdateTeam?: (id: number, team: Partial<Team>) => void;
  onDeleteTeam: (id: number) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  currentUser, settings, teams, employees, onUpdateSettings, onAddTeam, onUpdateTeam, onDeleteTeam 
}) => {
  const t = TRANSLATIONS[settings.language];
  const isAdmin = currentUser.role === 'admin';
  
  const [newCategory, setNewCategory] = useState('');
  const [newAssignment, setNewAssignment] = useState('');
  
  // Absence State
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [editingAbsenceOldName, setEditingAbsenceOldName] = useState<string | null>(null);
  const [absenceForm, setAbsenceForm] = useState<AbsenceType>({ name: '', color: '#9ca3af' });

  // Holiday State
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<'civil' | 'religious'>('civil');
  const [editingHolidayOldDate, setEditingHolidayOldDate] = useState<string | null>(null);

  // Group holidays by year
  const groupedHolidays = useMemo(() => {
    const groups: Record<string, Holiday[]> = {};
    settings.holidays.forEach(h => {
      const year = h.date.split('-')[0];
      if (!groups[year]) groups[year] = [];
      groups[year].push(h);
    });
    // Sort years descending
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [settings.holidays]);

  // Shift State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShiftIndex, setEditingShiftIndex] = useState<number | null>(null);
  const [shiftForm, setShiftForm] = useState<Shift>({ name: '', start: '08:00', end: '16:00', color: '#3b82f6' });

  // Team Modal State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null); 
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLeader, setNewTeamLeader] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  // Deletion Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'shift' | 'absence' | 'holiday' | 'team', id: any } | null>(null);

  const confirmDelete = (type: 'shift' | 'absence' | 'holiday' | 'team', id: any) => {
    setDeleteConfirm({ type, id });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    if (type === 'shift') {
        const newShifts = settings.shifts.filter((_, i) => i !== id);
        onUpdateSettings('shifts', newShifts);
    } else if (type === 'absence') {
        onUpdateSettings('absenceTypes', settings.absenceTypes.filter(a => a.name !== id));
    } else if (type === 'holiday') {
        onUpdateSettings('holidays', settings.holidays.filter(h => h.date !== id));
        if (editingHolidayOldDate === id) handleCancelEditHoliday();
    } else if (type === 'team') {
        onDeleteTeam(id);
    }
    setDeleteConfirm(null);
  };

  // Category Handlers
  const handleAddCategory = () => {
    if (newCategory && !settings.categories.includes(newCategory)) {
      onUpdateSettings('categories', [...settings.categories, newCategory]);
      setNewCategory('');
    }
  };
  
  const handleRemoveCategory = (cat: string) => {
    onUpdateSettings('categories', settings.categories.filter(c => c !== cat));
  };

  // Assignment Handlers
  const handleAddAssignment = () => {
    if (newAssignment && !settings.assignments.includes(newAssignment)) {
        onUpdateSettings('assignments', [...settings.assignments, newAssignment]);
        setNewAssignment('');
    }
  };

  const handleRemoveAssignment = (assign: string) => {
      onUpdateSettings('assignments', settings.assignments.filter(a => a !== assign));
  };

  // Absence Type Handlers
  const handleOpenAbsenceModal = (abs?: AbsenceType) => {
      if (abs) {
          setEditingAbsenceOldName(abs.name);
          setAbsenceForm(abs);
      } else {
          setEditingAbsenceOldName(null);
          setAbsenceForm({ name: '', color: '#9ca3af' });
      }
      setIsAbsenceModalOpen(true);
  };

  const handleSaveAbsence = (e: React.FormEvent) => {
      e.preventDefault();
      if (!absenceForm.name) return;
      
      let newAbsences = [...settings.absenceTypes];
      
      if (editingAbsenceOldName) {
          newAbsences = newAbsences.map(a => a.name === editingAbsenceOldName ? absenceForm : a);
      } else {
          if (newAbsences.some(a => a.name === absenceForm.name)) {
              alert("Name already exists");
              return;
          }
          newAbsences.push(absenceForm);
      }
      onUpdateSettings('absenceTypes', newAbsences);
      setIsAbsenceModalOpen(false);
  };

  // Holiday Handlers
  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (newHolidayDate && newHolidayName) {
      const newHoliday: Holiday = { date: newHolidayDate, name: newHolidayName, type: newHolidayType };
      let newHolidays = [...settings.holidays];
      
      if (editingHolidayOldDate) {
        newHolidays = newHolidays.filter(h => h.date !== editingHolidayOldDate);
      } else {
         if (newHolidays.some(h => h.date === newHolidayDate)) {
           alert("Date already exists");
           return;
         }
      }

      newHolidays.push(newHoliday);
      onUpdateSettings('holidays', newHolidays.sort((a,b) => a.date.localeCompare(b.date)));
      
      setNewHolidayDate('');
      setNewHolidayName('');
      setNewHolidayType('civil');
      setEditingHolidayOldDate(null);
    }
  };

  const handleEditHoliday = (h: Holiday) => {
    setNewHolidayDate(h.date);
    setNewHolidayName(h.name);
    setNewHolidayType(h.type || 'civil');
    setEditingHolidayOldDate(h.date);
  };

  const handleCancelEditHoliday = () => {
    setNewHolidayDate('');
    setNewHolidayName('');
    setNewHolidayType('civil');
    setEditingHolidayOldDate(null);
  };

  // Shift Handlers
  const handleOpenShiftModal = (index?: number) => {
    if (index !== undefined) {
      setEditingShiftIndex(index);
      setShiftForm(settings.shifts[index]);
    } else {
      setEditingShiftIndex(null);
      setShiftForm({ name: '', start: '08:00', end: '16:00', color: '#3b82f6' });
    }
    setIsShiftModalOpen(true);
  };

  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (shiftForm.name) {
      let newShifts = [...settings.shifts];
      if (editingShiftIndex !== null) {
        newShifts[editingShiftIndex] = shiftForm;
      } else {
        newShifts.push(shiftForm);
      }
      onUpdateSettings('shifts', newShifts);
      setIsShiftModalOpen(false);
    }
  };

  // Team Handlers
  const handleOpenTeamModal = (team?: Team) => {
    if (team) {
      setEditingTeamId(team.id);
      setNewTeamName(team.name);
      setNewTeamLeader(team.leaderId ? String(team.leaderId) : '');
      setSelectedMembers(team.members);
    } else {
      setEditingTeamId(null);
      setNewTeamName('');
      setNewTeamLeader('');
      setSelectedMembers([]);
    }
    setIsTeamModalOpen(true);
  };

  const toggleMemberSelection = (empId: number) => {
    setSelectedMembers(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const handleSaveTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeamName) {
      const teamData = {
        name: newTeamName,
        leaderId: newTeamLeader ? Number(newTeamLeader) : '',
        members: selectedMembers
      };

      if (editingTeamId && onUpdateTeam) {
        onUpdateTeam(editingTeamId, teamData);
      } else {
        onAddTeam(teamData);
      }
      setIsTeamModalOpen(false);
    }
  };

  const availableEmployees = employees.filter(e => 
    !e.teamId || (editingTeamId && e.teamId === editingTeamId)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-10">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{t.settings}</h2>
      </div>

      <section>
        <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
          <Globe size={16} /> {t.general_settings}
        </h3>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Langue / Language</label>
              <select 
                value={settings.language}
                onChange={(e) => onUpdateSettings('language', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                {settings.language === 'fr' ? 'Format de date' : 'Date Format'}
              </label>
              <select 
                value={settings.dateFormat}
                onChange={(e) => onUpdateSettings('dateFormat', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {isAdmin && (
        <>
            <div className="flex flex-col lg:flex-row gap-8">
                <section className="flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-2">
                    <Clock size={16} /> Shifts
                    </h3>
                    <Button onClick={() => handleOpenShiftModal()} icon={Plus} size="sm">
                    {t.add}
                    </Button>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex-1">
                    <div className="space-y-3">
                    {settings.shifts.map((shift, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: shift.color || '#3b82f6' }}></div>
                            <div>
                            <div className="font-semibold text-gray-800 text-sm">{shift.name}</div>
                            <div className="text-xs text-gray-500">{shift.start} - {shift.end}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleOpenShiftModal(index)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-white transition-colors">
                            <Edit2 size={14} />
                            </button>
                            <button onClick={() => confirmDelete('shift', index)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-white transition-colors">
                            <Trash2 size={14} />
                            </button>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
                </section>

                <section className="flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-2">
                        <CalendarOff size={16} /> {t.absence_types}
                    </h3>
                    <Button onClick={() => handleOpenAbsenceModal()} icon={Plus} size="sm">
                    {t.add}
                    </Button>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex-1">
                    <div className="space-y-3">
                    {settings.absenceTypes.map(abs => (
                        <div key={abs.name} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: abs.color }}></div>
                            <span className="font-semibold text-gray-800 text-sm">{abs.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleOpenAbsenceModal(abs)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-white transition-colors">
                            <Edit2 size={14} />
                            </button>
                            <button onClick={() => confirmDelete('absence', abs.name)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-white transition-colors">
                            <Trash2 size={14} />
                            </button>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
                </section>
            </div>

            <section>
                <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-2">
                    <UsersIcon size={16} /> {t.teams}
                </h3>
                <Button onClick={() => handleOpenTeamModal()} icon={Plus} size="sm">
                    {t.create}
                </Button>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-400 italic">
                        {settings.language === 'fr' ? 'Aucune équipe créée.' : 'No teams created.'}
                    </div>
                    )}
                    {teams.map(team => {
                    const leader = employees.find(e => e.id === team.leaderId);
                    return (
                        <div key={team.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative bg-gray-50/50">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-lg text-gray-800">{team.name}</h4>
                            <div className="flex gap-1">
                            <button onClick={() => handleOpenTeamModal(team)} className="text-gray-400 hover:text-blue-500 transition-colors p-1">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => confirmDelete('team', team.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                <Trash2 size={18} />
                            </button>
                            </div>
                        </div>
                        <div className="text-sm mb-3">
                            <span className="text-gray-500">{t.team_leader}: </span>
                            <span className="font-medium text-gray-900">{leader ? `${leader.firstName} ${leader.lastName}` : '-'}</span>
                        </div>
                        <div className="text-xs text-gray-500 bg-white p-2 rounded border border-gray-100">
                            {team.members.length} {t.team_members}
                        </div>
                        </div>
                    );
                    })}
                </div>
                </div>
            </section>

            <section>
                <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
                <CalendarDays size={16} /> {t.holidays}
                </h3>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <form onSubmit={handleAddHoliday} className="space-y-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Date</label>
                            <input 
                            required
                            type="date"
                            value={newHolidayDate}
                            onChange={(e) => setNewHolidayDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                        </div>
                        <div className="space-y-1 lg:col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Nom du jour</label>
                            <input 
                            required
                            type="text" 
                            value={newHolidayName} 
                            onChange={(e) => setNewHolidayName(e.target.value)}
                            placeholder="Ex: Fête du Travail"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                        </div>
                        <div className="space-y-1">
                             <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Type de jour</label>
                             <select 
                                value={newHolidayType}
                                onChange={(e) => setNewHolidayType(e.target.value as 'civil' | 'religious')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                             >
                                <option value="civil">{settings.language === 'fr' ? 'Civile' : 'Civil'}</option>
                                <option value="religious">{settings.language === 'fr' ? 'Religieux' : 'Religious'}</option>
                             </select>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-4 pt-2">
                        <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                            <Info size={14} className="text-blue-500" />
                            {newHolidayType === 'civil' 
                                ? (settings.language === 'fr' ? 'Les jours civils sont reportés chaque année automatiquement.' : 'Civil days are automatically repeated every year.')
                                : (settings.language === 'fr' ? 'Les jours religieux sont spécifiques à une date précise.' : 'Religious days are specific to a precise date.')
                            }
                        </p>
                        <div className="flex gap-2">
                            {editingHolidayOldDate && (
                                <Button type="button" variant="ghost" size="sm" onClick={handleCancelEditHoliday}>
                                {t.cancel}
                                </Button>
                            )}
                            <Button type="submit" size="sm">
                                {editingHolidayOldDate ? t.update : t.add}
                            </Button>
                        </div>
                    </div>
                </form>
                
                <div className="space-y-8">
                    {groupedHolidays.length === 0 ? <p className="text-sm text-gray-400 italic">No holidays configured</p> : null}
                    {groupedHolidays.map(([year, list]) => (
                        <div key={year} className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-slate-800 text-white rounded-lg shadow-sm">
                                    <Hash size={14} />
                                </div>
                                <h4 className="text-lg font-black text-slate-800 tracking-tight">{year}</h4>
                                <div className="h-px flex-1 bg-gray-100"></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {list.map(h => (
                                    <div key={h.date} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${h.type === 'religious' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                <CalendarDays size={18} />
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-gray-900">{formatDisplayDate(h.date, settings.dateFormat)}</span>
                                                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${h.type === 'religious' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                                        {h.type === 'religious' ? (settings.language === 'fr' ? 'Religieux' : 'Relig.') : (settings.language === 'fr' ? 'Civile' : 'Civil')}
                                                    </span>
                                                </div>
                                                <span className="text-sm text-gray-600 font-medium">{h.name}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditHoliday(h)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={t.edit}>
                                            <Edit2 size={14} />
                                            </button>
                                            <button onClick={() => confirmDelete('holiday', h.date)} className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title={t.delete}>
                                            <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                </div>
            </section>

            <div className="flex flex-col lg:flex-row gap-8">
                <section className="flex-1">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
                    <Briefcase size={16} /> {settings.language === 'fr' ? 'Catégories' : 'Categories'}
                </h3>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full">
                    <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={newCategory} 
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder={settings.language === 'fr' ? "Nouvelle catégorie..." : "New category..."}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <Button onClick={handleAddCategory} size="sm">{t.add}</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                    {settings.categories.map(cat => (
                        <div key={cat} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 group">
                        <span className="text-xs font-medium">{cat}</span>
                        <button onClick={() => handleRemoveCategory(cat)} className="text-blue-400 hover:text-blue-700">
                            <Trash2 size={12} />
                        </button>
                        </div>
                    ))}
                    </div>
                </div>
                </section>

                <section className="flex-1">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
                    <MapPin size={16} /> Assignments
                </h3>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full">
                    <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={newAssignment} 
                        onChange={(e) => setNewAssignment(e.target.value)}
                        placeholder="New assignment..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <Button onClick={handleAddAssignment} size="sm">{t.add}</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                    {settings.assignments.map(assign => (
                        <div key={assign} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100 group">
                        <span className="text-xs font-medium">{assign}</span>
                        <button onClick={() => handleRemoveAssignment(assign)} className="text-green-400 hover:text-green-700">
                            <Trash2 size={12} />
                        </button>
                        </div>
                    ))}
                    </div>
                </div>
                </section>
            </div>
        </>
      )}


      {/* CREATE/EDIT TEAM MODAL */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title={editingTeamId ? t.edit_team : t.create_team}
        size="md"
      >
        <form onSubmit={handleSaveTeam} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.team_name}
            </label>
            <input 
              required 
              type="text" 
              value={newTeamName} 
              onChange={e => setNewTeamName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.team_leader}
            </label>
            <select 
              value={newTeamLeader} 
              onChange={e => setNewTeamLeader(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">{settings.language === 'fr' ? 'Sélectionner un responsable...' : 'Select a leader...'}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.team_members} (Select)
            </label>
            <div className="border rounded-lg max-h-48 overflow-y-auto p-2 bg-gray-50">
              {availableEmployees.length === 0 ? (
                <p className="text-xs text-gray-500 p-2 text-center">
                  {settings.language === 'fr' 
                    ? 'Aucun employé disponible (tous sont assignés).' 
                    : 'No available employees (all are assigned).'}
                </p>
              ) : (
                availableEmployees.map(emp => (
                  <div 
                    key={emp.id} 
                    onClick={() => toggleMemberSelection(emp.id)}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${selectedMembers.includes(emp.id) ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
                  >
                    {selectedMembers.includes(emp.id) 
                      ? <CheckSquare size={18} className="text-blue-600" /> 
                      : <Square size={18} className="text-gray-400" />
                    }
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">{emp.firstName} {emp.lastName}</span>
                        <span className="text-xs text-gray-500">{emp.matricule}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsTeamModalOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="submit">
              {editingTeamId ? t.update : t.create}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CREATE/EDIT SHIFT MODAL */}
      <Modal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        title={editingShiftIndex !== null ? (settings.language === 'fr' ? 'Modifier le shift' : 'Edit Shift') : (settings.language === 'fr' ? 'Nouveau shift' : 'New Shift')}
        size="sm"
      >
        <form onSubmit={handleSaveShift} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input 
              required 
              type="text" 
              value={shiftForm.name} 
              onChange={e => setShiftForm({...shiftForm, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input 
                required 
                type="time" 
                value={shiftForm.start} 
                onChange={e => setShiftForm({...shiftForm, start: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <input 
                required 
                type="time" 
                value={shiftForm.end} 
                onChange={e => setShiftForm({...shiftForm, end: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex gap-2 items-center">
              <input 
                type="color" 
                value={shiftForm.color} 
                onChange={e => setShiftForm({...shiftForm, color: e.target.value})}
                className="h-10 w-20 rounded cursor-pointer border-0"
              />
              <span className="text-xs text-gray-500">{shiftForm.color}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsShiftModalOpen(false)}>{t.cancel}</Button>
            <Button type="submit">
              {t.save}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CREATE/EDIT ABSENCE MODAL */}
      <Modal
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        title={editingAbsenceOldName ? (settings.language === 'fr' ? 'Modifier le motif' : 'Edit Absence Type') : (settings.language === 'fr' ? 'Nouveau motif' : 'New Absence Type')}
        size="sm"
      >
        <form onSubmit={handleSaveAbsence} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input 
                    required
                    type="text" 
                    value={absenceForm.name} 
                    onChange={(e) => setAbsenceForm({...absenceForm, name: e.target.value})}
                    placeholder="Ex: Sick Leave"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex gap-2 items-center">
                    <input 
                        type="color" 
                        value={absenceForm.color}
                        onChange={(e) => setAbsenceForm({...absenceForm, color: e.target.value})}
                        className="h-10 w-20 rounded cursor-pointer border-0"
                    />
                    <span className="text-xs text-gray-500">{absenceForm.color}</span>
                </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setIsAbsenceModalOpen(false)}>
                    {t.cancel}
                </Button>
                <Button type="submit">
                    {t.save}
                </Button>
            </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={t.delete + '?'}
        size="sm"
      >
          <div className="space-y-4">
              <p className="text-sm text-gray-600">
                  {settings.language === 'fr' 
                    ? 'Êtes-vous sûr de vouloir supprimer cet élément ?' 
                    : 'Are you sure you want to delete this item?'}
              </p>
              <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
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
