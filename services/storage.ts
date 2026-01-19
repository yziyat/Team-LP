
import { useState, useEffect, useMemo, useRef } from 'react';
import { Employee, User, Team, AppSettings, PlanningData, Bonus, AuditLogEntry, Notification, Training } from '../types';
import { DEFAULT_USERS, DEFAULT_SETTINGS, getBrowserLanguage } from '../constants';
import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  updateDoc,
  query,
  orderBy,
  getDocs,
  limit,
  where,
  writeBatch
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  User as FirebaseUser
} from 'firebase/auth';

// Helper to calculate diffs for logging
const getDiff = (oldObj: any, newObj: any) => {
  const changes: string[] = [];
  Object.keys(newObj).forEach(key => {
    if (oldObj[key] !== newObj[key]) {
       let oldVal = oldObj[key];
       let newVal = newObj[key];
       if (oldVal === undefined || oldVal === null) oldVal = 'empty';
       if (newVal === undefined || newVal === null) newVal = 'empty';
       
       if (typeof newVal !== 'object') {
           changes.push(`${key}: "${oldVal}" -> "${newVal}"`);
       } else {
           if (Array.isArray(newVal)) {
               changes.push(`${key} updated`);
           }
       }
    }
  });
  return changes.join(', ');
};

const capitalize = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const useDataStore = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const localLang = localStorage.getItem('team_lp_lang');
    if (localLang === 'fr' || localLang === 'en') {
        return { ...DEFAULT_SETTINGS, language: localLang as 'fr' | 'en' };
    }
    return DEFAULT_SETTINGS;
  });

  const [planning, setPlanning] = useState<PlanningData>({});
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);

  const isSigningUp = useRef(false);
  const hasCleanedLogs = useRef(false);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const cleanupOldLogs = async () => {
    if (hasCleanedLogs.current) return;
    try {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const isoThreshold = twoMonthsAgo.toISOString();
      const logsRef = collection(db, "audit_logs");
      const q = query(logsRef, where("timestamp", "<", isoThreshold));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      hasCleanedLogs.current = true;
    } catch (e) {
      console.warn("Maintenance: Failed to cleanup logs", e);
    }
  };

  const handleFirestoreError = (error: any) => {
      const isPermissionError = error.code === 'permission-denied' || 
                                error.message?.includes('Missing or insufficient permissions');
      if (isPermissionError) {
          setPermissionError(true);
      } else {
          console.error("Firestore Error:", error);
          notify(`Sync Error: ${error.message}`, 'error');
      }
      setUsersLoading(false);
  };

  const handleWriteError = (e: any, context: string) => {
      console.error(`Error ${context}:`, e);
      notify(`Error ${context}: ${e.message}`, 'error');
  };

  useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
          setFirebaseUser(user);
          setAuthLoading(false);
          if (!user) {
              setEmployees([]);
              setTeams([]);
              setUsers([]);
              setPlanning({});
              setBonuses([]);
              setLogs([]);
              setTrainings([]);
              setPermissionError(false);
              setUsersLoading(true);
              setSettingsLoading(true);
              hasCleanedLogs.current = false;
          }
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
    const me = users.find(u => u.email.toLowerCase() === firebaseUser?.email?.toLowerCase());
    if (me?.role === 'admin' && !hasCleanedLogs.current) {
        cleanupOldLogs();
    }
  }, [users, firebaseUser]);

  const login = async (email: string, pass: string) => {
      try {
          await signInWithEmailAndPassword(auth, email, pass);
          return true;
      } catch (error: any) {
          notify("Invalid email or password.", 'error');
          return false;
      }
  };

  const signUp = async (email: string, pass: string, firstName: string = '', lastName: string = '') => {
      isSigningUp.current = true;
      try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
          const user = userCredential.user;
          await sendEmailVerification(user);
          const fullName = `${capitalize(firstName.trim())} ${capitalize(lastName.trim())}`.trim() || email.split('@')[0];
          await updateProfile(user, { displayName: fullName });
          
          let isFirstUser = false;
          try {
              const usersRef = collection(db, "users");
              const allUsersSnap = await getDocs(query(usersRef, limit(1)));
              isFirstUser = allUsersSnap.empty;
          } catch(e) {}

          const newUser: User = {
              id: Date.now(),
              name: fullName,
              email: user.email!,
              role: isFirstUser ? 'admin' : 'viewer',
              active: isFirstUser,
              emailVerified: isFirstUser
          };
          await setDoc(doc(db, "users", String(newUser.id)), newUser);
          notify("Account created! Please check your email to verify.", "info");
          return true;
      } catch (error: any) {
          notify(error.message, 'error');
          return false;
      } finally {
          setTimeout(() => { isSigningUp.current = false; }, 3000);
      }
  };

  const resendVerification = async () => {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
          try {
            await sendEmailVerification(auth.currentUser);
            notify("Verification email sent.", "success");
          } catch(e: any) {
             notify("Failed to send email.", "error");
          }
      }
  };

  const logout = async () => {
      try {
          await signOut(auth);
      } catch (error) {
          console.error(error);
      }
  };

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "employees"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: Employee[] = [];
      snapshot.forEach((doc: any) => items.push({ ...doc.data(), _docId: doc.id } as any));
      setEmployees(items);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "teams"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: Team[] = [];
      snapshot.forEach((doc: any) => items.push({ ...doc.data(), _docId: doc.id } as any));
      setTeams(items);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: User[] = [];
      snapshot.forEach((doc: any) => items.push({ ...doc.data(), _docId: doc.id } as any));
      setUsers(items);
      setUsersLoading(false);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const docRef = doc(db, "config", "settings");
    const unsubscribe = onSnapshot(docRef, (docSnap: any) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        const localLang = localStorage.getItem('team_lp_lang');
        const finalLang = (localLang === 'fr' || localLang === 'en') 
            ? localLang as 'fr' | 'en' 
            : (data.language || getBrowserLanguage());
        setSettings({ ...DEFAULT_SETTINGS, ...data, language: finalLang });
      } else {
        // IMPORTANT: We do NOT auto-initialize here with setDoc anymore.
        // This prevents micro-network issues from resetting the DB to defaults.
        // We just use defaults in the local UI state.
        setSettings(DEFAULT_SETTINGS);
      }
      setSettingsLoading(false);
    }, (error: any) => {
         console.warn("Settings sync failed:", error.message);
         setSettingsLoading(false);
    });
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "planning"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const newPlanning: PlanningData = {};
      snapshot.forEach((doc: any) => {
         const data = doc.data();
         newPlanning[doc.id] = data.shift;
      });
      setPlanning(newPlanning);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "bonuses"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: Bonus[] = [];
      snapshot.forEach((doc: any) => items.push({ ...doc.data(), _docId: doc.id } as any));
      setBonuses(items);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "trainings"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: Training[] = [];
      snapshot.forEach((doc: any) => items.push({ ...doc.data(), _docId: doc.id } as any));
      setTrainings(items);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: AuditLogEntry[] = [];
      snapshot.forEach((doc: any) => items.push(doc.data() as AuditLogEntry));
      setLogs(items);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  const addLog = async (action: string, details: string) => {
    const id = Date.now();
    const newLog: AuditLogEntry = {
      id,
      timestamp: new Date().toISOString(),
      action,
      details,
      user: firebaseUser?.email || 'Unknown'
    };
    try {
      await setDoc(doc(db, "audit_logs", String(id)), newLog);
    } catch (e) {
      console.error("Failed to add log", e);
    }
  };

  const robustDelete = async (collectionName: string, id: number | string, docId?: string) => {
      let deleted = false;
      if (docId) {
          try {
            await deleteDoc(doc(db, collectionName, docId));
            deleted = true;
          } catch(e) {}
      }
      if (!isNaN(Number(id))) {
          try {
            const qNum = query(collection(db, collectionName), where("id", "==", Number(id)));
            const snapNum = await getDocs(qNum);
            for (const d of snapNum.docs) { await deleteDoc(d.ref); deleted = true; }
          } catch(e) {}
      }
      try {
        const qStr = query(collection(db, collectionName), where("id", "==", String(id)));
        const snapStr = await getDocs(qStr);
        for (const d of snapStr.docs) { await deleteDoc(d.ref); deleted = true; }
      } catch(e) {}
      if (!deleted) {
          try {
            await deleteDoc(doc(db, collectionName, String(id)));
            deleted = true;
          } catch(e) {}
      }
      return deleted;
  };

  const addEmployee = async (emp: Omit<Employee, 'id'>) => {
    if (!/^[a-zA-Z0-9]+$/.test(emp.matricule)) {
        notify(settings.language === 'fr' 
            ? "Erreur : Le matricule ne doit contenir que des lettres et des chiffres." 
            : "Error: Matricule must contain only letters and numbers.", 'error');
        return;
    }
    const duplicate = employees.find(e => e.matricule.trim().toLowerCase() === emp.matricule.trim().toLowerCase());
    if (duplicate) {
        notify(settings.language === 'fr'
            ? `Erreur : Un employé avec le matricule "${emp.matricule}" existe déjà.`
            : `Error: Employee with Matricule "${emp.matricule}" already exists.`, 'error');
        return;
    }
    const id = Date.now();
    const newEmp = JSON.parse(JSON.stringify({ ...emp, id }));
    try {
      await setDoc(doc(db, "employees", String(id)), newEmp);
      addLog('CREATE_EMPLOYEE', `Added employee ${emp.firstName} ${emp.lastName}`);
      notify('Employee added successfully');
    } catch (e: any) {
      handleWriteError(e, "adding employee");
    }
  };

  const updateEmployee = async (id: number, data: Partial<Employee>) => {
    const oldEmp = employees.find(e => e.id == id);
    if (!oldEmp) return;
    if (data.matricule) {
        if (!/^[a-zA-Z0-9]+$/.test(data.matricule)) {
            notify(settings.language === 'fr' 
                ? "Erreur : Le matricule ne doit contenir que des lettres et des chiffres." 
                : "Error: Matricule must contain only letters and numbers.", 'error');
            return;
        }
        if (data.matricule.trim().toLowerCase() !== oldEmp.matricule.trim().toLowerCase()) {
            const duplicate = employees.find(e => e.id !== id && e.matricule.trim().toLowerCase() === data.matricule.trim().toLowerCase());
            if (duplicate) {
                notify(settings.language === 'fr'
                    ? `Erreur : Un employé avec le matricule "${data.matricule}" existe déjà.`
                    : `Error: Employee with Matricule "${data.matricule}" already exists.`, 'error');
                return;
            }
        }
    }
    const diff = getDiff(oldEmp, { ...oldEmp, ...data });
    const docRef = (oldEmp as any)._docId ? doc(db, "employees", (oldEmp as any)._docId) : doc(db, "employees", String(id));
    try {
      await updateDoc(docRef, data);
      if (diff) {
          addLog('UPDATE_EMPLOYEE', `Updated Emp ${id}: ${diff}`);
          notify('Employee updated');
      } else if (data.exitDate) {
          addLog('EMPLOYEE_EXIT', `Set exit date for ID ${id} to ${data.exitDate}`);
          notify('Employee exit date set');
      }
    } catch (e) {
      handleWriteError(e, "updating employee");
    }
  };

  const deleteEmployee = async (id: number) => {
    const emp = employees.find(e => e.id == id);
    const docId = (emp as any)?._docId;
    try {
      await robustDelete("employees", id, docId);
      teams.forEach(t => {
        const tDocRef = (t as any)._docId ? doc(db, "teams", (t as any)._docId) : doc(db, "teams", String(t.id));
        if (t.members.includes(id)) {
           const newMembers = t.members.filter(m => m != id);
           updateDoc(tDocRef, { members: newMembers });
        }
        if (t.leaderId == id) { updateDoc(tDocRef, { leaderId: '' }); }
      });
      const relatedBonuses = bonuses.filter(b => b.employeeId == id);
      for (const b of relatedBonuses) {
          const bDocId = (b as any)._docId || b.id;
          await deleteDoc(doc(db, "bonuses", bDocId));
      }
      addLog('DELETE_EMPLOYEE', `Deleted employee ${emp?.firstName} ${emp?.lastName} (${id})`);
      notify('Employee deleted');
    } catch (e) {
      handleWriteError(e, "deleting employee");
    }
  };

  const addTeam = async (team: Omit<Team, 'id'>) => {
    const id = Date.now();
    const newTeam = { ...team, id };
    try {
      await setDoc(doc(db, "teams", String(id)), newTeam);
      if (team.members && team.members.length > 0) {
         team.members.forEach(empId => {
             const emp = employees.find(e => e.id == empId);
             if (emp) {
                const eDocRef = (emp as any)?._docId ? doc(db, "employees", (emp as any)._docId) : doc(db, "employees", String(empId));
                updateDoc(eDocRef, { teamId: id });
             }
         });
      }
      addLog('CREATE_TEAM', `Created team ${team.name}`);
      notify('Team created');
    } catch (e) { handleWriteError(e, "creating team"); }
  };

  const updateTeam = async (id: number, data: Partial<Team>) => {
    const oldTeam = teams.find(t => t.id == id);
    if (!oldTeam) return;
    const diff = getDiff(oldTeam, { ...oldTeam, ...data });
    const docRef = (oldTeam as any)._docId ? doc(db, "teams", (oldTeam as any)._docId) : doc(db, "teams", String(id));
    try {
      await updateDoc(docRef, data);
      if (data.members) {
        const removedMembers = oldTeam.members.filter(mId => !data.members!.some(nm => nm == mId));
        const addedMembers = data.members.filter(mId => !oldTeam.members.some(om => om == mId));
        removedMembers.forEach(mId => {
             const emp = employees.find(e => e.id == mId);
             if (emp) {
                 const eDocRef = (emp as any)?._docId ? doc(db, "employees", (emp as any)._docId) : doc(db, "employees", String(mId));
                 updateDoc(eDocRef, { teamId: null } as any);
             }
        });
        addedMembers.forEach(mId => {
             const emp = employees.find(e => e.id == mId);
             if (emp) {
                 const eDocRef = (emp as any)?._docId ? doc(db, "employees", (emp as any)._docId) : doc(db, "employees", String(mId));
                 updateDoc(eDocRef, { teamId: id });
             }
        });
      }
      addLog('UPDATE_TEAM', `Updated team ${oldTeam.name}. ${diff}`);
      notify('Team updated');
    } catch (e) { handleWriteError(e, "updating team"); }
  };

  const deleteTeam = async (id: number) => {
    const team = teams.find(t => t.id == id);
    const docId = (team as any)?._docId;
    try {
      await robustDelete("teams", id, docId);
      employees.filter(e => e.teamId == id).forEach(e => {
          const eDocRef = (e as any)?._docId ? doc(db, "employees", (e as any)._docId) : doc(db, "employees", String(e.id));
          updateDoc(eDocRef, { teamId: null } as any);
      });
      addLog('DELETE_TEAM', `Deleted team ${team?.name}`);
      notify('Team deleted');
    } catch (e) { handleWriteError(e, "deleting team"); }
  };

  const updateSettings = async (key: keyof AppSettings, value: any) => {
    try {
      // Use setDoc with merge to ensure the document exists and is updated safely
      await setDoc(doc(db, "config", "settings"), { [key]: value }, { merge: true });
      
      if (key === 'language') {
        localStorage.setItem('team_lp_lang', value);
        setSettings(prev => ({ ...prev, language: value }));
      }
      
      addLog('UPDATE_SETTINGS', `Changed setting ${key}`);
      notify('Settings updated');
    } catch (e) { handleWriteError(e, "updating settings"); }
  };

  const setPlanningItem = async (employeeId: number, dateStr: string, shiftName: string | null) => {
    const key = `${employeeId}_${dateStr}`;
    try {
      if (shiftName) {
        await setDoc(doc(db, "planning", key), { shift: shiftName });
      } else {
        await deleteDoc(doc(db, "planning", key));
      }
    } catch (e) { console.error("Error updating planning", e); }
  };

  const addUser = async (user: Omit<User, 'id'>) => {
    const id = Date.now();
    try {
      await setDoc(doc(db, "users", String(id)), { ...user, id, emailVerified: true });
      addLog('CREATE_USER', `Created user ${user.name}`);
      notify('User added');
    } catch (e) { handleWriteError(e, "adding user"); }
  };

  const updateUser = async (id: number, data: Partial<User>) => {
    if (id === 0 && firebaseUser && firebaseUser.email) {
         const newId = Date.now();
         const newUser: User = {
             id: newId,
             name: data.name || firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User',
             email: firebaseUser.email,
             role: data.role || 'viewer',
             active: data.active ?? true,
             employeeId: data.employeeId,
             emailVerified: firebaseUser.emailVerified
         };
         try {
             await setDoc(doc(db, "users", String(newId)), newUser);
             notify("User profile created from virtual state");
         } catch (e) { handleWriteError(e, "creating user profile"); }
         return;
    }
    const oldUser = users.find(u => u.id == id);
    if (!oldUser) return;
    const diff = getDiff(oldUser, { ...oldUser, ...data });
    const docRef = (oldUser as any)._docId ? doc(db, "users", (oldUser as any)._docId) : doc(db, "users", String(id));
    try {
      await updateDoc(docRef, data);
      addLog('UPDATE_USER', `Updated user ID ${id}: ${diff}`);
      notify('User updated');
    } catch (e) { handleWriteError(e, "updating user"); }
  };

  const deleteUser = async (id: number) => {
    const user = users.find(u => u.id == id);
    if (!user) return;
    const docId = (user as any)?._docId;
    try {
      await robustDelete("users", id, docId);
      addLog('DELETE_USER', `Deleted user ${user?.name} (${id})`);
      notify('User deleted');
    } catch (e) { handleWriteError(e, "deleting user"); }
  };

  const setBonus = async (employeeId: number, month: string, amount: number) => {
    const id = `${employeeId}_${month}`;
    try {
      if (amount === 0) {
        try { await deleteDoc(doc(db, "bonuses", id)); } catch(e) {}
        const q = query(collection(db, "bonuses"), where("employeeId", "==", employeeId), where("month", "==", month));
        const snap = await getDocs(q);
        snap.forEach(d => deleteDoc(d.ref));
      } else {
        await setDoc(doc(db, "bonuses", id), { id, employeeId, month, amount });
      }
    } catch (e) { console.error("Error setting bonus", e); }
  };

  const addTraining = async (training: Omit<Training, 'id'>) => {
    const id = Date.now();
    try {
      await setDoc(doc(db, "trainings", String(id)), { ...training, id });
      addLog('CREATE_TRAINING', `Created training ${training.title}`);
      notify('Training created');
    } catch (e) { handleWriteError(e, "creating training"); }
  };

  const updateTraining = async (id: number, data: Partial<Training>) => {
      const old = trainings.find(t => t.id == id);
      if(!old) return;
      const docRef = (old as any)._docId ? doc(db, "trainings", (old as any)._docId) : doc(db, "trainings", String(id));
      try {
          await updateDoc(docRef, data);
          notify('Training updated');
      } catch (e) { handleWriteError(e, "updating training"); }
  };

  const deleteTraining = async (id: number) => {
      const t = trainings.find(t => t.id == id);
      const docId = (t as any)?._docId;
      try {
          await robustDelete("trainings", id, docId);
          addLog('DELETE_TRAINING', `Deleted training ${t?.title || id}`);
          notify('Training deleted');
      } catch (e) { handleWriteError(e, "deleting training"); }
  };

  const effectiveUsers = useMemo(() => {
    if (!firebaseUser || !firebaseUser.email) return users;
    const exists = users.some(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
    if (exists) return users;

    const virtualUser: User = {
        id: 0,
        name: firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User',
        email: firebaseUser.email,
        role: users.length === 0 ? 'admin' : 'viewer',
        active: users.length === 0,
        emailVerified: firebaseUser.emailVerified
    };
    return [virtualUser, ...users];
  }, [users, firebaseUser]);

  return {
    employees, teams, users: effectiveUsers, settings, planning, bonuses, logs, trainings, notifications,
    authLoading, usersLoading, settingsLoading, permissionError, firebaseUser, login, signUp, resendVerification, logout, notify,
    addEmployee, updateEmployee, deleteEmployee, addTeam, updateTeam, deleteTeam, updateSettings, setPlanningItem,
    addUser, updateUser, deleteUser, setBonus, addTraining, updateTraining, deleteTraining
  };
};
