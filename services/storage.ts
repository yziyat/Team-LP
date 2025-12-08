
import { useState, useEffect } from 'react';
import { Employee, User, Team, AppSettings, PlanningData, Bonus, AuditLogEntry } from '../types';
import { DEFAULT_USERS, DEFAULT_SETTINGS } from '../constants';

// Helper to safely parse JSON
const load = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error loading ${key}`, e);
    return fallback;
  }
};

export const useDataStore = () => {
  const [employees, setEmployees] = useState<Employee[]>(() => load('employees', []));
  const [teams, setTeams] = useState<Team[]>(() => load('teams', []));
  const [users, setUsers] = useState<User[]>(() => load('users', DEFAULT_USERS));
  const [settings, setSettings] = useState<AppSettings>(() => {
     const loaded = load('settings', DEFAULT_SETTINGS);
     // Merge defaults for new fields if missing
     return { ...DEFAULT_SETTINGS, ...loaded };
  });
  const [planning, setPlanning] = useState<PlanningData>(() => load('planning', {}));
  const [bonuses, setBonuses] = useState<Bonus[]>(() => load('bonuses', []));
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => load('audit_logs', []));

  // Persist effects
  useEffect(() => localStorage.setItem('employees', JSON.stringify(employees)), [employees]);
  useEffect(() => localStorage.setItem('teams', JSON.stringify(teams)), [teams]);
  useEffect(() => localStorage.setItem('users', JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem('settings', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('planning', JSON.stringify(planning)), [planning]);
  useEffect(() => localStorage.setItem('bonuses', JSON.stringify(bonuses)), [bonuses]);
  useEffect(() => localStorage.setItem('audit_logs', JSON.stringify(logs)), [logs]);

  // Logging Helper
  const addLog = (action: string, details: string) => {
    const newLog: AuditLogEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      action,
      details,
      user: 'Admin' // Hardcoded for this demo context
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Actions
  const addEmployee = (emp: Omit<Employee, 'id'>) => {
    const newEmp = { ...emp, id: Date.now() };
    setEmployees(prev => [...prev, newEmp]);
    addLog('CREATE_EMPLOYEE', `Added employee ${emp.firstName} ${emp.lastName}`);
  };

  const updateEmployee = (id: number, data: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
    if (data.exitDate) {
      addLog('EMPLOYEE_EXIT', `Set exit date for ID ${id} to ${data.exitDate}`);
    } else if (data.entryDate) {
       addLog('EMPLOYEE_ENTRY', `Set entry date for ID ${id} to ${data.entryDate}`);
    } else {
      addLog('UPDATE_EMPLOYEE', `Updated employee ID ${id}`);
    }
  };

  const deleteEmployee = (id: number) => {
    const emp = employees.find(e => e.id === id);
    setEmployees(prev => prev.filter(e => e.id !== id));
    // Also remove from teams and bonuses
    setTeams(prev => prev.map(t => ({
      ...t,
      members: t.members.filter(mId => mId !== id),
      leaderId: t.leaderId === id ? '' : t.leaderId
    })));
    setBonuses(prev => prev.filter(b => b.employeeId !== id));
    addLog('DELETE_EMPLOYEE', `Deleted employee ${emp?.firstName} ${emp?.lastName} (${id})`);
  };

  const addTeam = (team: Omit<Team, 'id'>) => {
    const newTeamId = Date.now();
    const newTeam = { ...team, id: newTeamId };
    setTeams(prev => [...prev, newTeam]);
    
    // Update employees to assign them to this team
    if (team.members && team.members.length > 0) {
      setEmployees(prev => prev.map(emp => 
        team.members.includes(emp.id) 
          ? { ...emp, teamId: newTeamId } 
          : emp
      ));
    }
    addLog('CREATE_TEAM', `Created team ${team.name}`);
  };

  const updateTeam = (id: number, data: Partial<Team>) => {
    // We need to handle member changes carefully
    const oldTeam = teams.find(t => t.id === id);
    if (!oldTeam) return;

    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));

    // If members list changed, update employees
    if (data.members) {
      const oldMembers = oldTeam.members;
      const newMembers = data.members;

      // 1. Find removed members -> set teamId to undefined
      const removedMembers = oldMembers.filter(mId => !newMembers.includes(mId));
      
      // 2. Find added members -> set teamId to id
      const addedMembers = newMembers.filter(mId => !oldMembers.includes(mId));

      if (removedMembers.length > 0 || addedMembers.length > 0) {
        setEmployees(prev => prev.map(emp => {
          if (removedMembers.includes(emp.id)) {
            return { ...emp, teamId: undefined };
          }
          if (addedMembers.includes(emp.id)) {
            return { ...emp, teamId: id };
          }
          return emp;
        }));
      }
    }
    addLog('UPDATE_TEAM', `Updated team ${oldTeam.name} details/members`);
  };

  const deleteTeam = (id: number) => {
    const team = teams.find(t => t.id === id);
    setTeams(prev => prev.filter(t => t.id !== id));
    // Remove teamId from employees
    setEmployees(prev => prev.map(emp => 
      emp.teamId === id ? { ...emp, teamId: undefined } : emp
    ));
    addLog('DELETE_TEAM', `Deleted team ${team?.name}`);
  };

  const updateSettings = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    addLog('UPDATE_SETTINGS', `Changed setting ${key}`);
  };

  const setPlanningItem = (employeeId: number, dateStr: string, shiftName: string | null) => {
    setPlanning(prev => {
      const key = `${employeeId}_${dateStr}`;
      const next = { ...prev };
      if (shiftName) {
        next[key] = shiftName;
      } else {
        delete next[key];
      }
      return next;
    });
    // Optional: Log planning changes? Might be too verbose.
    // addLog('UPDATE_PLANNING', `Shift change for Emp ${employeeId} on ${dateStr}`);
  };

  const addUser = (user: Omit<User, 'id'>) => {
    setUsers(prev => [...prev, { ...user, id: Date.now() }]);
    addLog('CREATE_USER', `Created user ${user.name}`);
  };

  const updateUser = (id: number, data: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    addLog('UPDATE_USER', `Updated user ID ${id}`);
  };

  const deleteUser = (id: number) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    addLog('DELETE_USER', `Deleted user ID ${id}`);
  };

  const setBonus = (employeeId: number, month: string, amount: number) => {
    setBonuses(prev => {
      const id = `${employeeId}_${month}`;
      const exists = prev.find(b => b.id === id);
      if (exists) {
        if (amount === 0) return prev.filter(b => b.id !== id);
        return prev.map(b => b.id === id ? { ...b, amount } : b);
      }
      return [...prev, { id, employeeId, month, amount }];
    });
    addLog('UPDATE_BONUS', `Bonus update for Emp ${employeeId} (${month}): ${amount}`);
  };

  return {
    employees,
    teams,
    users,
    settings,
    planning,
    bonuses,
    logs,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addTeam,
    updateTeam,
    deleteTeam,
    updateSettings,
    setPlanningItem,
    addUser,
    updateUser,
    deleteUser,
    setBonus
  };
};