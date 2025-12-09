
import React, { useState } from 'react';
import { Plus, Trash2, CheckSquare, Square, Globe, Briefcase, Users as UsersIcon, Clock, Edit2, CalendarOff, CalendarDays } from 'lucide-react';
import { AppSettings, Team, Employee, Shift, Holiday, AbsenceType } from '../types';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { TRANSLATIONS, formatDisplayDate } from '../constants';

interface SettingsProps {
  settings: AppSettings;
  teams: Team[];
  employees: Employee[];
  onUpdateSettings: (key: keyof AppSettings, value: any) => void;
  onAddTeam: (team: Omit<Team, 'id'>) => void;
  onUpdateTeam?: (id: number, team: Partial<Team>) => void;
  onDeleteTeam: (id: number) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  settings, teams, employees, onUpdateSettings, onAddTeam, onUpdateTeam, onDeleteTeam 
}) => {
  const t = TRANSLATIONS[settings.language];
  
  const [newCategory, setNewCategory] = useState('');
  const [newAbsenceType, setNewAbsenceType] = useState<AbsenceType>({ name: '', color: '#9ca3af' });
  
  // Holiday State
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [editingHolidayOldDate, setEditingHolidayOldDate] = useState<string | null>(null);

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

  // Absence Type Handlers
  const handleAddAbsence = () => {
    if (newAbsenceType.name && !settings.absenceTypes.some(a => a.name === newAbsenceType.name)) {
      onUpdateSettings('absenceTypes', [...settings.absenceTypes, newAbsenceType]);
      setNewAbsenceType({ name: '', color: '#9ca3af' });
    }
  };

  const handleRemoveAbsence = (absName: string) => {
    onUpdateSettings('absenceTypes', settings.absenceTypes.filter(a => a.name !== absName));
  };

  // Holiday Handlers
  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (newHolidayDate && newHolidayName) {
      const newHoliday: Holiday = { date: newHolidayDate, name: newHolidayName };
      let newHolidays = [...settings.holidays];
      
      // If editing, remove old entry first
      if (editingHolidayOldDate) {
        newHolidays = newHolidays.filter(h => h.date !== editingHolidayOldDate);
      } else {
         // Check duplicate only if adding new
         if (newHolidays.some(h => h.date === newHolidayDate)) {
           alert("Date already exists");
           return;
         }
      }

      newHolidays.push(newHoliday);
      onUpdateSettings('holidays', newHolidays.sort((a,b) => a.date.localeCompare(b.date)));
      
      // Reset
      setNewHolidayDate('');
      setNewHolidayName('');
      setEditingHolidayOldDate(null);
    }
  };

  const handleEditHoliday = (h: Holiday) => {
    setNewHolidayDate(h.date);
    setNewHolidayName(h.name);
    setEditingHolidayOldDate(h.date);
  };

  const handleCancelEditHoliday = () => {
    setNewHolidayDate('');
    setNewHolidayName('');
    setEditingHolidayOldDate(null);
  };

  const handleRemoveHoliday = (date: string) => {
    if(window.confirm(t.delete + '?')) {
      onUpdateSettings('holidays', settings.holidays.filter(h => h.date !== date));
      if (editingHolidayOldDate === date) handleCancelEditHoliday();
    }
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

  const handleDeleteShift = (index: number) => {
    if (window.confirm(t.delete + '?')) {
      const newShifts = settings.shifts.filter((_, i) => i !== index);
      onUpdateSettings('shifts', newShifts);
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
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{t.settings}</h2>
      </div>

      {/* GLOBAL SETTINGS SECTION */}
      <section>
        <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
          <Globe size={16} /> {t.general_settings}
        </h3>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Langue / Language</label>
              <select 
                value={settings.language}
                onChange={(e) => onUpdateSettings('language', e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {settings.language === 'fr' ? 'Format de date' : 'Date Format'}
              </label>
              <select 
                value={settings.dateFormat}
                onChange={(e) => onUpdateSettings('dateFormat', e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* PUBLIC HOLIDAYS SECTION */}
      <section>
        <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
          <CalendarDays size={16} /> {t.holidays}
        </h3>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <form onSubmit={handleAddHoliday} className="flex flex-col sm:flex-row gap-2 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <input 
              required
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <input 
              required
              type="text" 
              value={newHolidayName} 
              onChange={(e) => setNewHolidayName(e.target.value)}
              placeholder="Ex: New Year"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-1">
              {editingHolidayOldDate && (
                 <Button type="button" variant="ghost" size="sm" onClick={handleCancelEditHoliday}>
                   {t.cancel}
                 </Button>
              )}
              <Button type="submit" size="sm">
                {editingHolidayOldDate ? t.update : t.add}
              </Button>
            </div>
          </form>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {settings.holidays.length === 0 ? <p className="text-sm text-gray-400 italic">No holidays configured</p> : null}
            {settings.holidays.map(h => (
               <div key={h.date} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800">{formatDisplayDate(h.date, settings.dateFormat)}</span>
                    <span className="text-sm text-gray-600">{h.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEditHoliday(h)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title={t.edit}>
                       <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleRemoveHoliday(h.date)} className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors" title={t.delete}>
                      <Trash2 size={14} />
                    </button>
                  </div>
               </div>
            ))}
          </div>
        </div>
      </section>

      {/* SHIFT & ABSENCE SETTINGS SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-2">
              <Clock size={16} /> Shifts
            </h3>
            <Button onClick={() => handleOpenShiftModal()} icon={Plus} size="sm">
              {t.add}
            </Button>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
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
                    <button onClick={() => handleDeleteShift(index)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-white transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
            <CalendarOff size={16} /> {t.absence_types}
          </h3>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newAbsenceType.name} 
                onChange={(e) => setNewAbsenceType({...newAbsenceType, name: e.target.value})}
                placeholder="Ex: Maladie..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-2 bg-white">
                <input 
                  type="color" 
                  value={newAbsenceType.color}
                  onChange={(e) => setNewAbsenceType({...newAbsenceType, color: e.target.value})}
                  className="w-6 h-6 border-0 p-0 cursor-pointer"
                />
              </div>
              <Button onClick={handleAddAbsence} size="sm">{t.add}</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.absenceTypes.map(abs => (
                <div key={abs.name} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-full border border-gray-200 shadow-sm group">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: abs.color }}></div>
                  <span className="text-xs font-medium">{abs.name}</span>
                  <button onClick={() => handleRemoveAbsence(abs.name)} className="text-gray-400 hover:text-red-600 ml-1">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* TEAM MANAGEMENT SECTION */}
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
                      <button onClick={() => onDeleteTeam(team.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
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

      {/* CATEGORIES SECTION */}
      <section>
        <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-4 flex items-center gap-2">
          <Briefcase size={16} /> {settings.language === 'fr' ? 'Catégories' : 'Categories'}
        </h3>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newCategory} 
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder={settings.language === 'fr' ? "Nouvelle catégorie..." : "New category..."}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                    ? 'Aucun employé disponible.' 
                    : 'No employees available.'}
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
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <input 
                required 
                type="time" 
                value={shiftForm.end} 
                onChange={e => setShiftForm({...shiftForm, end: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
            <Button type="button" variant="ghost" onClick={() => setIsShiftModalOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="submit">
              {t.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
