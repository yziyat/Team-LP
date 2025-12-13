
import { useState, useEffect, useMemo, useRef } from 'react';
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
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [planning, setPlanning] = useState<PlanningData>({});
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Auth & Loading State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true); // New: Wait for DB users to load
  const [permissionError, setPermissionError] = useState(false);

  // Ref to prevent race conditions during signup (prevent duplicate creation)
  const isSigningUp = useRef(false);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000); // Slightly longer timeout to read error messages
  };

  const handleFirestoreError = (error: any) => {
      const isPermissionError = error.code === 'permission-denied' || 
                                error.message?.includes('Missing or insufficient permissions') ||
                                error.toString().includes('Missing or insufficient permissions');

      if (isPermissionError) {
          console.warn("Firestore Permission Error: Data cannot be read/written.");
          console.warn("SOLUTION: Copy the content of 'firestore.rules' to your Firebase Console > Firestore Database > Rules.");
          setPermissionError(true);
      } else {
          console.error("Firestore Error:", error);
          notify(`Sync Error: ${error.message}`, 'error');
      }
      // Ensure loading stops even on error so app isn't stuck
      setUsersLoading(false);
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
              setUsersLoading(true); // Reset for next login
          } else {
              setPermissionError(false); 
              
              // CRITICAL FIX: Prevent fallback logic if we are in the middle of a signup flow
              if (isSigningUp.current) return;

              // SYNC LOGIC: Check if user is verified in Auth but not in Firestore
              if (user.emailVerified) {
                  try {
                       const usersRef = collection(db, "users");
                       const q = query(usersRef, where("email", "==", user.email));
                       const snapshot = await getDocs(q);
                       if (!snapshot.empty) {
                           const docSnap = snapshot.docs[0];
                           const userData = docSnap.data() as User;
                           if (!userData.emailVerified) {
                               console.log("Syncing emailVerified status to Firestore...");
                               await updateDoc(docSnap.ref, { emailVerified: true });
                           }
                       }
                  } catch(e) { console.error("Sync error", e); }
              }

              // Basic check/sync only if user is logged in but doc missing (Legacy support or Manual Auth creation)
              // We delay this slightly to allow snapshot listener to populate 'users' first
              setTimeout(async () => {
                  if (!user.email) return;
                  if (isSigningUp.current) return; // Double check

                  try {
                      const usersRef = collection(db, "users");
                      const q = query(usersRef, where("email", "==", user.email));
                      const snapshot = await getDocs(q);
                      
                      if (snapshot.empty) {
                          // NOTE: This is a fallback. Standard SignUp flow handles this via signUp() function.
                          console.log("User doc missing in Firestore. Creating fallback...");
                          let isFirstUser = false;
                          try {
                             const allUsersSnap = await getDocs(query(usersRef, limit(1)));
                             isFirstUser = allUsersSnap.empty;
                          } catch (e) {
                             console.warn("Could not check user list size", e);
                          }
                          
                          const newUser: User = {
                              id: Date.now(),
                              name: user.displayName || user.email.split('@')[0],
                              email: user.email,
                              role: isFirstUser ? 'admin' : 'viewer',
                              active: isFirstUser, // Only active if first user (Admin)
                              emailVerified: user.emailVerified
                          };
                          
                          await setDoc(doc(db, "users", String(newUser.id)), newUser);
                      }
                  } catch (e: any) {
                      // Ignore permission errors here, they are handled elsewhere
                  }
              }, 2000);
          }
      });
      return () => unsubscribe();
  }, []);

  const effectiveUsers = useMemo(() => {
    if (!firebaseUser || !firebaseUser.email) return users;
    
    // Check if current firebase user exists in the firestore users list
    const exists = users.some(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
    if (exists) return users;

    // Create a temporary "virtual" user object for UI while Firestore syncs
    // This prevents "undefined" errors but keeps active=false until real data loads
    const virtualUser: User = {
        id: 0,
        name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        email: firebaseUser.email,
        role: 'viewer', 
        active: false, 
        emailVerified: firebaseUser.emailVerified
    };
    
    return [...users, virtualUser];
  }, [users, firebaseUser]);

  const login = async (email: string, pass: string) => {
      try {
          await signInWithEmailAndPassword(auth, email, pass);
          return true;
      } catch (error: any) {
          let msg = "Login failed";
          const errorCode = error.code;
          
          if (errorCode === 'auth/invalid-credential' || 
              errorCode === 'auth/user-not-found' || 
              errorCode === 'auth/wrong-password' || 
              errorCode === 'auth/invalid-login-credentials') {
              msg = "Invalid email or password.";
          } else if (errorCode === 'auth/too-many-requests') {
              msg = "Too many failed attempts. Try again later.";
          } else if (errorCode === 'auth/network-request-failed') {
              msg = "Network error. Please check your connection.";
          } else {
              console.error("Login Error:", error);
              if (error.message) msg += `: ${error.message}`;
          }
          notify(msg, 'error');
          return false;
      }
  };

  const signUp = async (email: string, pass: string, firstName: string = '', lastName: string = '') => {
      // SET FLAG TO TRUE: Prevent onAuthStateChanged from creating a duplicate
      isSigningUp.current = true;
      
      try {
          // 1. Create Auth User
          const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
          const user = userCredential.user;
          
          // 2. Send Verification Email
          await sendEmailVerification(user);

          // Format Name properly
          const cleanFirst = capitalize(firstName.trim());
          const cleanLast = capitalize(lastName.trim());
          const fullName = `${cleanFirst} ${cleanLast}`.trim() || email.split('@')[0];

          // 3. Update Auth Profile
          await updateProfile(user, { displayName: fullName });

          // 4. Determine if this is the first user (Admin)
          let isFirstUser = false;
          try {
              const usersRef = collection(db, "users");
              const allUsersSnap = await getDocs(query(usersRef, limit(1)));
              isFirstUser = allUsersSnap.empty;
          } catch(e) {
              console.warn("Could not determine if first user", e);
          }

          // 5. Create Firestore Document explicitly
          const newUser: User = {
              id: Date.now(),
              name: fullName,
              email: user.email!,
              role: isFirstUser ? 'admin' : 'viewer',
              active: isFirstUser, // TRUE only if first user
              emailVerified: isFirstUser // First user is implicitly trusted or will verify
          };

          await setDoc(doc(db, "users", String(newUser.id)), newUser);
          
          notify("Account created! Please check your email to verify.", "info");
          return true;
      } catch (error: any) {
          let msg = "Sign up failed";
          const errorCode = error.code;

          if (errorCode === 'auth/email-already-in-use') {
              msg = "This email is already registered. Please Log In.";
          } else if (errorCode === 'auth/weak-password') {
              msg = "Password is too weak. It should be at least 6 characters.";
          } else if (errorCode === 'auth/invalid-email') {
              msg = "The email address is invalid.";
          } else if (errorCode === 'auth/network-request-failed') {
              msg = "Network error. Please check your internet connection.";
          } else if (errorCode === 'auth/operation-not-allowed') {
              msg = "Email/Password sign-up is not enabled in Firebase Console.";
          } else {
              console.error("Signup Error:", error);
              if (error.message) msg += `: ${error.message}`;
          }
          notify(msg, 'error');
          return false;
      } finally {
          // Reset the flag after a short delay to ensure listeners have fired and data is stable
          setTimeout(() => {
              isSigningUp.current = false;
          }, 3000);
      }
  };

  const resendVerification = async () => {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
          try {
            await sendEmailVerification(auth.currentUser);
            notify("Verification email sent.", "success");
          } catch(e: any) {
             if (e.code === 'auth/too-many-requests') {
                 notify("Too many requests. Please wait before retrying.", "error");
             } else {
                 notify("Failed to send email.", "error");
             }
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

  // --- Firestore Subscriptions ---
  
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
      setUsersLoading(false); // Data is loaded, safe to remove Loading Screen / Pending Flash
    }, handleFirestoreError);
    return () => unsubscribe();
  }, [firebaseUser]);

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
        setDoc(docRef, DEFAULT_SETTINGS).catch((err: any) => console.log("Init settings failed", err));
        setSettings(DEFAULT_SETTINGS);
      }
    }, (error: any) => {
         console.warn("Settings sync failed (using defaults):", error.message);
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

  // Improved Robust Deletion
  const robustDelete = async (collectionName: string, id: number | string, docId?: string) => {
      let deleted = false;
      
      // 1. Try known Doc ID from Snapshot (Direct Hit)
      if (docId) {
          try {
            await deleteDoc(doc(db, collectionName, docId));
            deleted = true;
          } catch(e) { console.warn("Robust delete: docId failed", e); }
      }
      
      // Continue to cleanup ANY potential duplicates (ghost records) with the same ID field
      
      // 2. Query by Number ID
      if (!isNaN(Number(id))) {
          try {
            const qNum = query(collection(db, collectionName), where("id", "==", Number(id)));
            const snapNum = await getDocs(qNum);
            for (const d of snapNum.docs) { 
                await deleteDoc(d.ref); 
                deleted = true; 
            }
          } catch(e) {}
      }

      // 3. Query by String ID
      try {
        const qStr = query(collection(db, collectionName), where("id", "==", String(id)));
        const snapStr = await getDocs(qStr);
        for (const d of snapStr.docs) { 
            await deleteDoc(d.ref); 
            deleted = true; 
        }
      } catch(e) {}

      // 4. Fallback Direct ID as Key (Legacy)
      if (!deleted) {
          try {
            await deleteDoc(doc(db, collectionName, String(id)));
            deleted = true;
          } catch(e) {}
      }
      
      return deleted;
  };

  const addEmployee = async (emp: Omit<Employee, 'id'>) => {
    // Validation: Alphanumeric check
    if (!/^[a-zA-Z0-9]+$/.test(emp.matricule)) {
        notify(settings.language === 'fr' 
            ? "Erreur : Le matricule ne doit contenir que des lettres et des chiffres." 
            : "Error: Matricule must contain only letters and numbers.", 'error');
        return;
    }

    // Check for duplicate matricule
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
    
    // Check for matricule constraints if changing
    if (data.matricule) {
        // Validation: Alphanumeric check
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
      
      // Cleanup relations
      teams.forEach(t => {
        const tDocRef = (t as any)._docId ? doc(db, "teams", (t as any)._docId) : doc(db, "teams", String(t.id));
        if (t.members.includes(id)) {
           const newMembers = t.members.filter(m => m != id); // loose eq
           updateDoc(tDocRef, { members: newMembers });
        }
        if (t.leaderId == id) { // loose eq
           updateDoc(tDocRef, { leaderId: '' });
        }
      });

      // Cleanup Bonuses
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
    } catch (e) {
      handleWriteError(e, "creating team");
    }
  };

  const updateTeam = async (id: number, data: Partial<Team>) => {
    const oldTeam = teams.find(t => t.id == id);
    if (!oldTeam) return;

    const diff = getDiff(oldTeam, { ...oldTeam, ...data });
    const docRef = (oldTeam as any)._docId ? doc(db, "teams", (oldTeam as any)._docId) : doc(db, "teams", String(id));

    try {
      await updateDoc(docRef, data);

      if (data.members) {
        const oldMembers = oldTeam.members;
        const newMembers = data.members;
        
        const removedMembers = oldMembers.filter(mId => !newMembers.some(nm => nm == mId));
        const addedMembers = newMembers.filter(mId => !oldMembers.some(om => om == mId));

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
    } catch (e) {
      handleWriteError(e, "updating team");
    }
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
      await setDoc(doc(db, "users", String(id)), { ...user, id, emailVerified: true }); // Admin added users are verified
      addLog('CREATE_USER', `Created user ${user.name}`);
      notify('User added');
    } catch (e) {
      handleWriteError(e, "adding user");
    }
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
         } catch (e) {
             handleWriteError(e, "creating user profile");
         }
         return;
    }

    const oldUser = users.find(u => u.id == id);
    if (!oldUser) return;

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
    const docRef = (oldUser as any)._docId ? doc(db, "users", (oldUser as any)._docId) : doc(db, "users", String(id));

    try {
      await updateDoc(docRef, data);
      addLog('UPDATE_USER', `Updated user ID ${id}: ${diff}`);
      notify('User updated');
    } catch (e) {
      handleWriteError(e, "updating user");
    }
  };

  const deleteUser = async (id: number) => {
    const user = users.find(u => u.id == id);
    if (!user) return;

    if (user.role === 'admin' && user.active) {
        const adminCount = users.filter(u => u.role === 'admin' && u.active).length;
        if (adminCount <= 1) {
            notify("Cannot delete the only active administrator.", "error");
            return;
        }
    }

    const docId = (user as any)._docId;

    try {
      await robustDelete("users", id, docId);
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
        try { await deleteDoc(doc(db, "bonuses", id)); } catch(e) {}
        
        const q = query(collection(db, "bonuses"), where("employeeId", "==", employeeId), where("month", "==", month));
        const snap = await getDocs(q);
        snap.forEach(d => deleteDoc(d.ref));
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
      const old = trainings.find(t => t.id == id);
      if(!old) return;
      
      const docRef = (old as any)._docId ? doc(db, "trainings", (old as any)._docId) : doc(db, "trainings", String(id));

      try {
          // Attempt direct update if docId is known
          if ((old as any)._docId) {
             await updateDoc(docRef, data);
          } else {
             // Fallback
             let q = query(collection(db, "trainings"), where("id", "==", id));
             let snapshot = await getDocs(q);
             if (snapshot.empty) {
                q = query(collection(db, "trainings"), where("id", "==", String(id)));
                snapshot = await getDocs(q);
             }
             if (!snapshot.empty) {
                await updateDoc(snapshot.docs[0].ref, data);
             } else {
                await updateDoc(docRef, data);
             }
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
      const t = trainings.find(t => t.id == id);
      const docId = (t as any)?._docId;
      try {
          await robustDelete("trainings", id, docId);
          addLog('DELETE_TRAINING', `Deleted training ${t?.title || id}`);
          notify('Training deleted');
      } catch (e) {
          handleWriteError(e, "deleting training");
      }
  };

  return {
    employees,
    teams,
    users: effectiveUsers, 
    settings,
    planning,
    bonuses,
    logs,
    trainings,
    notifications,
    authLoading,
    usersLoading, // Exported to be checked in App.tsx
    permissionError,
    firebaseUser,
    login,
    signUp,
    resendVerification,
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
