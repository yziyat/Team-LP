
import { useState, useEffect } from 'react';
import { Employee, User, Team, AppSettings, PlanningData, Bonus, AuditLogEntry, Notification } from '../types';
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

const getDiff = (oldObj: any, newObj: any) => {
  const changes: string[] = [];
  Object.keys(newObj).forEach(key => {
    // skip internal keys or complex objects for simple logging if needed
    if (oldObj[key] !== newObj[key]) {
       // Format simple values
       let oldVal = oldObj[key];
       let newVal = newObj[key];
       if (oldVal === undefined || oldVal === null) oldVal = 'empty';
       if (newVal === undefined || newVal === null) newVal = 'empty';
       
       if (typeof newVal !== 'object') {
           changes.push(`${key}: "${oldVal}" -> "${newVal}"`);
       } else {
           // For arrays like members, simple 'changed' notification or join
           if (Array.isArray(newVal)) {
               changes.push(`${key} updated`);
           }
       }
    }
  });
  return changes.join(', ');
};

export const useDataStore = () => {
  const [employees, setEmployees] = useState<Employee[]>(() => load('employees', []));
  const [teams, setTeams] = useState<Team[]>(() => load('teams', []));
  const [users, setUsers] = useState<User[]>(() => load('users', DEFAULT_USERS));
  const [settings, setSettings] = useState<AppSettings>(() => {
     const loaded = load('settings', DEFAULT_SETTINGS);
     // Data Migration: Ensure absenceTypes are objects
     if (loaded.absenceTypes && typeof loaded.absenceTypes[0] === 'string') {
        loaded.absenceTypes = (loaded.absenceTypes as unknown as string[]).map(name => ({
           name,
           color: '#9ca3af' // Default gray
        }));
     }
     return { ...DEFAULT_SETTINGS, ...loaded };
  });
  const [planning, setPlanning] = useState<PlanningData>(() => load('planning', {}));
  const [bonuses, setBonuses] = useState<Bonus[]>(() => load('bonuses', []));
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => load('audit_logs', []));
  
  // Notification System
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

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
    notify('Employee added successfully');
  };

  const updateEmployee = (id: number, data: Partial<Employee>) => {
    let diff = '';
    setEmployees(prev => prev.map(e => {
        if (e.id === id) {
            diff = getDiff(e, { ...e, ...data });
            return { ...e, ...data };
        }
        return e;
    }));
    
    if (diff) {
        addLog('UPDATE_EMPLOYEE', `Updated Emp ${id}: ${diff}`);
        notify('Employee updated');
    } else if (data.exitDate) {
        // Fallback if logic misses it
        addLog('EMPLOYEE_EXIT', `Set exit date for ID ${id} to ${data.exitDate}`);
        notify('Employee exit date set');
    }
  };

  const deleteEmployee = (id: number) => {
    const emp = employees.find(e => e.id === id);
    setEmployees(prev => prev.filter(e => e.id !== id));
    setTeams(prev => prev.map(t => ({
      ...t,
      members: t.members.filter(mId => mId !== id),
      leaderId: t.leaderId === id ? '' : t.leaderId
    })));
    setBonuses(prev => prev.filter(b => b.employeeId !== id));
    addLog('DELETE_EMPLOYEE', `Deleted employee ${emp?.firstName} ${emp?.lastName} (${id})`);
    notify('Employee deleted');
  };

  const addTeam = (team: Omit<Team, 'id'>) => {
    const newTeamId = Date.now();
    const newTeam = { ...team, id: newTeamId };
    setTeams(prev => [...prev, newTeam]);
    
    if (team.members && team.members.length > 0) {
      setEmployees(prev => prev.map(emp => 
        team.members.includes(emp.id) 
          ? { ...emp, teamId: newTeamId } 
          : emp
      ));
    }
    addLog('CREATE_TEAM', `Created team ${team.name}`);
    notify('Team created');
  };

  const updateTeam = (id: number, data: Partial<Team>) => {
    const oldTeam = teams.find(t => t.id === id);
    if (!oldTeam) return;

    // Calculate diff for simple fields
    const diff = getDiff(oldTeam, { ...oldTeam, ...data });

    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));

    if (data.members) {
      const oldMembers = oldTeam.members;
      const newMembers = data.members;
      const removedMembers = oldMembers.filter(mId => !newMembers.includes(mId));
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
    addLog('UPDATE_TEAM', `Updated team ${oldTeam.name}. ${diff}`);
    notify('Team updated');
  };

  const deleteTeam = (id: number) => {
    const team = teams.find(t => t.id === id);
    setTeams(prev => prev.filter(t => t.id !== id));
    setEmployees(prev => prev.map(emp => 
      emp.teamId === id ? { ...emp, teamId: undefined } : emp
    ));
    addLog('DELETE_TEAM', `Deleted team ${team?.name}`);
    notify('Team deleted');
  };

  const updateSettings = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    addLog('UPDATE_SETTINGS', `Changed setting ${key}`);
    notify('Settings updated');
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
    // Optional: too verbose to notify every cell change
  };

  const addUser = (user: Omit<User, 'id'>) => {
    setUsers(prev => [...prev, { ...user, id: Date.now() }]);
    addLog('CREATE_USER', `Created user ${user.name}`);
    notify('User added');
  };

  const updateUser = (id: number, data: Partial<User>) => {
    let diff = '';
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
          diff = getDiff(u, { ...u, ...data });
          return { ...u, ...data };
      }
      return u;
    }));
    addLog('UPDATE_USER', `Updated user ID ${id}: ${diff}`);
    notify('User updated');
  };

  const deleteUser = (id: number) => {
    setUsers(prev => {
        const user = prev.find(u => u.id === id);
        if (user) {
            addLog('DELETE_USER', `Deleted user ${user.name} (${id})`);
            notify('User deleted');
        }
        return prev.filter(u => u.id !== id);
    });
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
  };

  return {
    employees,
    teams,
    users,
    settings,
    planning,
    bonuses,
    logs,
    notifications,
    notify,
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
