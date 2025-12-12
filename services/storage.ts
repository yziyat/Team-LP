
import { useState, useEffect, useMemo } from 'react';
import { Employee, User, Team, AppSettings, PlanningData, Bonus, AuditLogEntry, Notification, Training } from '../types';
import { DEFAULT_USERS, DEFAULT_SETTINGS } from '../constants';
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
  where
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
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

export const useDataStore = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [planning, setPlanning] = useState<PlanningData>({});
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]); // New state
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Auth State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 1500); // Reduced to 1.5s for faster dismissal
  };

  const handleFirestoreError = (error: any) => {
      const isPermissionError = error.code === 'permission-denied' || 
                                error.message?.includes('Missing or insufficient permissions') ||
                                error.toString().includes('Missing or insufficient permissions');

      if (isPermissionError) {
          // Warning with clear instructions
          console.warn("Firestore Permission Error: Data cannot be read/written.");
          console.warn("SOLUTION: Copy the content of 'firestore.rules' to your Firebase Console > Firestore Database > Rules.");
      } else {
          console.error("Firestore Error:", error);
          notify(`Sync Error: ${error.message}`, 'error');
      }
  };

  const handleWriteError = (e: any, context: string) => {
      console.error(`Error ${context}:`, e);
      if (e.code === 'permission-denied' || e.message?.includes('Missing or insufficient permissions')) {
          notify(`Permission Denied: Please update Rules in Firebase Console.`, 'error');
      } else {
          notify(`Error ${context}: ${e.message}`, 'error');
      }
  };

  // --- Auth Subscription ---
  useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
          setFirebaseUser(user);
          setAuthLoading(false);
          if (!user) {
              // Clear data on logout
              setEmployees([]);
              setTeams([]);
              setUsers([]);
              setPlanning({});
              setBonuses([]);
              setLogs([]);
              setTrainings([]);
              setPermissionError(false);
          } else {
              setPermissionError(false); // Reset on login
              
              // Auto-sync: Check if user exists in Firestore, if not create it
              (async () => {
                  if (!user.email) return;
                  try {
                      const usersRef = collection(db, "users");
                      const q = query(usersRef, where("email", "==", user.email));
                      const snapshot = await getDocs(q);
                      
                      if (snapshot.empty) {
                          console.log("User not found in Firestore. Creating profile...");
                          // Check if this is the first user (make admin)
                          let isFirstUser = false;
                          try {
                             const allUsersSnap = await getDocs(query(usersRef, limit(1)));
                             isFirstUser = allUsersSnap.empty;
                          } catch (e) {
                             // If list fails (permissions), default to assuming we might be first or just proceed safely
                             console.warn("Could not check user list size", e);
                          }
                          
                          const newUser: User = {
                              id: Date.now(),
                              name: user.displayName || user.email.split('@')[0],
                              email: user.email,
                              role: isFirstUser ? 'admin' : 'viewer',
                              active: true 
                          };
                          
                          await setDoc(doc(db, "users", String(newUser.id)), newUser);
                          notify("User profile synchronized", "info");
                      }
                  } catch (e: any) {
                      // Silence permission errors during auto-sync to avoid UI noise.
                      const isPermissionError = e.code === 'permission-denied' || 
                                                e.message?.includes('Missing or insufficient permissions') ||
                                                e.toString().includes('Missing or insufficient permissions');

                      if (!isPermissionError) {
                          console.error("Error syncing user profile", e);
                      } else {
                          console.warn("Auto-sync: Permission denied (using virtual user). Check Firestore Rules.");
                      }
                  }
              })();
          }
      });
      return () => unsubscribe();
  }, []);

  // Compute effective users list
  // If the authenticated user is NOT in the DB list (due to sync delay or permission error),
  // inject them as a "Virtual User" so they appear in the UI and can act as Admin.
  const effectiveUsers = useMemo(() => {
    if (!firebaseUser || !firebaseUser.email) return users;
    
    const exists = users.some(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
    if (exists) return users;

    // Create Virtual User
    const virtualUser: User = {
        id: 0, // ID 0 marks it as virtual
        name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        email: firebaseUser.email,
        role: users.length === 0 ? 'admin' : 'viewer', // Be Admin if list is empty (first user scenario)
        active: true
    };
    
    return [...users, virtualUser];
  }, [users, firebaseUser]);

  const login = async (email: string, pass: string) => {
      try {
          await signInWithEmailAndPassword(auth, email, pass);
          return true;
      } catch (error: any) {
          // Do not console.error expected auth errors to keep console clean
          let msg = "Login failed";
          const errorCode = error.code;
          
          if (errorCode === 'auth/invalid-credential' || 
              errorCode === 'auth/user-not-found' || 
              errorCode === 'auth/wrong-password' || 
              errorCode === 'auth/invalid-login-credentials') {
              msg = "Invalid email or password.";
          } else if (errorCode === 'auth/too-many-requests') {
              msg = "Too many failed attempts. Try again later.";
          } else {
              console.error("Login Error:", error);
              if (error.message) msg += `: ${error.message}`;
          }
          notify(msg, 'error');
          return false;
      }
  };

  const signUp = async (email: string, pass: string) => {
      try {
          await createUserWithEmailAndPassword(auth, email, pass);
          
          let isFirstUser = false;
          try {
             const usersRef = collection(db, "users");
             const snapshot = await getDocs(query(usersRef, limit(1)));
             isFirstUser = snapshot.empty;
          } catch (e) {
             console.log("Could not check for first user, defaulting to standard flow");
          }

          const newUser: User = {
              id: Date.now(),
              name: email.split('@')[0],
              email: email,
              role: isFirstUser ? 'admin' : 'viewer',
              active: isFirstUser ? true : false, 
          };

          await setDoc(doc(db, "users", String(newUser.id)), newUser);
          
          if (isFirstUser) {
              notify("Admin account created successfully!", 'success');
          } else {
              notify("Account created! Please wait for admin approval.", 'success');
          }
          return true;
      } catch (error: any) {
          let msg = "Sign up failed";
          const errorCode = error.code;

          if (errorCode === 'auth/email-already-in-use') {
              msg = "Email already in use. Please Log In instead.";
          } else if (errorCode === 'auth/weak-password') {
              msg = "Password should be at least 6 characters.";
          } else if (errorCode === 'auth/invalid-email') {
              msg = "Invalid email address.";
          } else if (errorCode === 'permission-denied') {
              msg = "Account created but profile sync failed. Check Firestore Rules.";
              console.error("Signup Permission Error:", error);
          } else {
              console.error("Signup Error:", error);
              if (error.message) msg += `: ${error.message}`;
          }
          notify(msg, 'error');
          return false;
      }
  };

  const logout = async () => {
      try {
          await signOut(auth);
      } catch (error) {
          console.error(error);
      }
  };

  // --- Firestore Subscriptions (Only when authenticated) ---

  // Employees
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "employees"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: Employee[] = [];
      snapshot.forEach((doc: any) => items.push(doc.data() as Employee));
      setEmployees(items);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  // Teams
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "teams"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: Team[] = [];
      snapshot.forEach((doc: any) => items.push(doc.data() as Team));
      setTeams(items);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  // Users
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: User[] = [];
      snapshot.forEach((doc: any) => items.push(doc.data() as User));
      setUsers(items);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  // Settings
  useEffect(() => {
    if (!firebaseUser) return;
    const docRef = doc(db, "config", "settings");
    const unsubscribe = onSnapshot(docRef, (docSnap: any) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        if (data.absenceTypes && typeof data.absenceTypes[0] === 'string') {
           data.absenceTypes = (data.absenceTypes as unknown as string[]).map(name => ({
              name,
              color: '#9ca3af'
           }));
        }
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        setDoc(docRef, DEFAULT_SETTINGS).catch((err: any) => console.log("Init settings failed (likely permissions)", err));
        setSettings(DEFAULT_SETTINGS);
      }
    }, (error: any) => {
         // Silently handle settings error to default
         console.warn("Settings sync failed (using defaults):", error.message);
    });
    return () => unsubscribe();
  }, [firebaseUser]);

  // Planning
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

  // Bonuses
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "bonuses"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: Bonus[] = [];
      snapshot.forEach((doc: any) => items.push(doc.data() as Bonus));
      setBonuses(items);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  // Trainings
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, "trainings"));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items: Training[] = [];
      snapshot.forEach((doc: any) => items.push(doc.data() as Training));
      setTrainings(items);
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

  // Logs
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


  // --- Actions ---

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

  const addEmployee = async (emp: Omit<Employee, 'id'>) => {
    const id = Date.now();
    // Sanitize the object to remove any undefined values which Firestore rejects
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
    const oldEmp = employees.find(e => e.id === id);
    if (!oldEmp) return;
    
    const diff = getDiff(oldEmp, { ...oldEmp, ...data });
    
    try {
      await updateDoc(doc(db, "employees", String(id)), data);
      
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
    const emp = employees.find(e => e.id === id);
    try {
      await deleteDoc(doc(db, "employees", String(id)));
      
      teams.forEach(t => {
        if (t.members.includes(id)) {
           const newMembers = t.members.filter(m => m !== id);
           updateDoc(doc(db, "teams", String(t.id)), { members: newMembers });
        }
        if (t.leaderId === id) {
           updateDoc(doc(db, "teams", String(t.id)), { leaderId: '' });
        }
      });

      bonuses.filter(b => b.employeeId === id).forEach(b => {
         deleteDoc(doc(db, "bonuses", b.id));
      });

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
             updateDoc(doc(db, "employees", String(empId)), { teamId: id });
         });
      }

      addLog('CREATE_TEAM', `Created team ${team.name}`);
      notify('Team created');
    } catch (e) {
      handleWriteError(e, "creating team");
    }
  };

  const updateTeam = async (id: number, data: Partial<Team>) => {
    const oldTeam = teams.find(t => t.id === id);
    if (!oldTeam) return;

    const diff = getDiff(oldTeam, { ...oldTeam, ...data });

    try {
      await updateDoc(doc(db, "teams", String(id)), data);

      if (data.members) {
        const oldMembers = oldTeam.members;
        const newMembers = data.members;
        const removedMembers = oldMembers.filter(mId => !newMembers.includes(mId));
        const addedMembers = newMembers.filter(mId => !oldMembers.includes(mId));

        removedMembers.forEach(mId => {
             updateDoc(doc(db, "employees", String(mId)), { teamId: null } as any);
        });
        
        addedMembers.forEach(mId => {
             updateDoc(doc(db, "employees", String(mId)), { teamId: id });
        });
      }

      addLog('UPDATE_TEAM', `Updated team ${oldTeam.name}. ${diff}`);
      notify('Team updated');
    } catch (e) {
      handleWriteError(e, "updating team");
    }
  };

  const deleteTeam = async (id: number) => {
    const team = teams.find(t => t.id === id);
    try {
      await deleteDoc(doc(db, "teams", String(id)));
      
      employees.filter(e => e.teamId === id).forEach(e => {
          updateDoc(doc(db, "employees", String(e.id)), { teamId: null } as any);
      });

      addLog('DELETE_TEAM', `Deleted team ${team?.name}`);
      notify('Team deleted');
    } catch (e) {
      handleWriteError(e, "deleting team");
    }
  };

  const updateSettings = async (key: keyof AppSettings, value: any) => {
    try {
      await updateDoc(doc(db, "config", "settings"), { [key]: value });
      addLog('UPDATE_SETTINGS', `Changed setting ${key}`);
      notify('Settings updated');
    } catch (e) {
      handleWriteError(e, "updating settings");
    }
  };

  const setPlanningItem = async (employeeId: number, dateStr: string, shiftName: string | null) => {
    const key = `${employeeId}_${dateStr}`;
    try {
      if (shiftName) {
        await setDoc(doc(db, "planning", key), { shift: shiftName });
      } else {
        await deleteDoc(doc(db, "planning", key));
      }
    } catch (e) {
      console.error("Error updating planning", e);
    }
  };

  const addUser = async (user: Omit<User, 'id'>) => {
    const id = Date.now();
    try {
      await setDoc(doc(db, "users", String(id)), { ...user, id });
      addLog('CREATE_USER', `Created user ${user.name}`);
      notify('User added');
    } catch (e) {
      handleWriteError(e, "adding user");
    }
  };

  const updateUser = async (id: number, data: Partial<User>) => {
    // Handle Virtual User (ID 0) Promotion -> Create Real User
    if (id === 0 && firebaseUser && firebaseUser.email) {
         const newId = Date.now();
         const newUser: User = {
             id: newId,
             name: data.name || firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User',
             email: firebaseUser.email,
             role: data.role || 'viewer',
             active: data.active ?? true,
             employeeId: data.employeeId
         };
         try {
             await setDoc(doc(db, "users", String(newId)), newUser);
             notify("User profile created from virtual state");
         } catch (e) {
             handleWriteError(e, "creating user profile");
         }
         return;
    }

    const oldUser = users.find(u => u.id === id);
    if (!oldUser) return;

    // PROTECTION: Cannot demote or deactivate the last admin
    if (oldUser.role === 'admin' && oldUser.active) {
         const willLoseAdmin = (data.role && data.role !== 'admin') || (data.active === false);
         if (willLoseAdmin) {
             const adminCount = users.filter(u => u.role === 'admin' && u.active).length;
             if (adminCount <= 1) {
                 notify("Cannot demote or deactivate the only active administrator.", "error");
                 return;
             }
         }
    }

    const diff = getDiff(oldUser, { ...oldUser, ...data });
    
    try {
      await updateDoc(doc(db, "users", String(id)), data);
      addLog('UPDATE_USER', `Updated user ID ${id}: ${diff}`);
      notify('User updated');
    } catch (e) {
      handleWriteError(e, "updating user");
    }
  };

  const deleteUser = async (id: number) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    // PROTECTION: Cannot delete the last admin
    if (user.role === 'admin' && user.active) {
        const adminCount = users.filter(u => u.role === 'admin' && u.active).length;
        if (adminCount <= 1) {
            notify("Cannot delete the only active administrator.", "error");
            return;
        }
    }

    try {
      await deleteDoc(doc(db, "users", String(id)));
      addLog('DELETE_USER', `Deleted user ${user?.name} (${id})`);
      notify('User deleted');
    } catch (e) {
      handleWriteError(e, "deleting user");
    }
  };

  const setBonus = async (employeeId: number, month: string, amount: number) => {
    const id = `${employeeId}_${month}`;
    try {
      if (amount === 0) {
        await deleteDoc(doc(db, "bonuses", id));
      } else {
        await setDoc(doc(db, "bonuses", id), { id, employeeId, month, amount });
      }
    } catch (e) {
      console.error("Error setting bonus", e);
    }
  };

  const addTraining = async (training: Omit<Training, 'id'>) => {
    const id = Date.now();
    const newTraining = { ...training, id };
    try {
      await setDoc(doc(db, "trainings", String(id)), newTraining);
      addLog('CREATE_TRAINING', `Created training ${training.title}`);
      notify('Training created');
    } catch (e) {
      handleWriteError(e, "creating training");
    }
  };

  const updateTraining = async (id: number, data: Partial<Training>) => {
      const old = trainings.find(t => t.id === id);
      if(!old) return;
      try {
          // Robust update: Query by field 'id' first
          const q = query(collection(db, "trainings"), where("id", "==", id));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
              const docRef = snapshot.docs[0].ref;
              await updateDoc(docRef, data);
          } else {
              // Fallback
              await updateDoc(doc(db, "trainings", String(id)), data);
          }

          if (data.status && data.status !== old.status) {
              addLog('UPDATE_TRAINING_STATUS', `Training ${old.title} moved to ${data.status}`);
          }
          notify('Training updated');
      } catch (e) {
          handleWriteError(e, "updating training");
      }
  };

  const deleteTraining = async (id: number) => {
      const t = trainings.find(t => t.id === id);
      try {
          // Robust deletion: Query by field 'id' to find the document reference
          // This handles cases where the doc ID is not exactly "String(id)" (e.g. manual import or migration)
          const q = query(collection(db, "trainings"), where("id", "==", id));
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
              // Fallback: Try direct ID just in case
              await deleteDoc(doc(db, "trainings", String(id)));
          } else {
              // Delete all matching docs (should be one)
              snapshot.forEach(async (d) => {
                  await deleteDoc(d.ref);
              });
          }

          addLog('DELETE_TRAINING', `Deleted training ${t?.title}`);
          notify('Training deleted');
      } catch (e) {
          handleWriteError(e, "deleting training");
      }
  };

  return {
    employees,
    teams,
    users: effectiveUsers, // Use the computed users list that includes virtual fallback
    settings,
    planning,
    bonuses,
    logs,
    trainings,
    notifications,
    authLoading,
    permissionError,
    firebaseUser,
    login,
    signUp,
    logout,
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
    setBonus,
    addTraining,
    updateTraining,
    deleteTraining
  };
};
