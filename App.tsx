
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Settings as SettingsIcon, 
  LogOut,
  Menu,
  X,
  Home as HomeIcon,
  UserPlus,
  Award,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Clock,
  GraduationCap,
  Mail,
  RefreshCw
} from 'lucide-react';
import { useDataStore } from './services/storage';
import { auth } from './services/firebase'; // Import auth for manual reload
import { Home } from './components/Home';
import { Dashboard } from './components/Dashboard';
import { EmployeeList } from './components/EmployeeList';
import { Planning } from './components/Planning';
import { Settings } from './components/Settings';
import { UserList } from './components/UserList';
import { Bonus } from './components/Bonus';
import { AuditLog } from './components/AuditLog';
import { Training } from './components/Training';
import { Login } from './components/Login';
import { NavItem } from './components/NavItem';
import { Toast } from './components/ui/Toast';
import { TabName, User } from './types';
import { TRANSLATIONS } from './constants';

function App() {
  const { 
    employees, teams, users, settings, planning, bonuses, logs, trainings, notifications,
    authLoading, usersLoading, settingsLoading, firebaseUser, permissionError, login, signUp, logout, resendVerification,
    addEmployee, updateEmployee, deleteEmployee,
    updateSettings, addTeam, updateTeam, deleteTeam,
    setPlanningItem, addUser, updateUser, deleteUser,
    setBonus, addTraining, updateTraining, deleteTraining, notify
  } = useDataStore();

  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  useEffect(() => {
    document.documentElement.lang = settings.language;
    document.title = settings.language === 'fr' ? 'Team LP - Gestion' : 'Team LP - Management';
  }, [settings.language]);

  const dbUser = firebaseUser && firebaseUser.email 
      ? users.find(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase())
      : null;
      
  const currentUser: User = dbUser || (firebaseUser ? {
      id: 0,
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      email: firebaseUser.email || '',
      role: users.length === 0 ? 'admin' : 'viewer',
      active: users.length === 0,
      emailVerified: firebaseUser.emailVerified
  } : { id: 0, name: '', email: '', role: 'viewer', active: false });

  const isAdmin = currentUser.role === 'admin';

  const visibleTeams = useMemo(() => {
    if (!firebaseUser) return []; 
    if (isAdmin) return teams;
    return teams.filter(t => t.leaderId === currentUser.employeeId);
  }, [isAdmin, teams, currentUser.employeeId, firebaseUser]);

  const visibleEmployees = useMemo(() => {
    if (!firebaseUser) return [];
    if (isAdmin) return employees;
    const ledTeamIds = visibleTeams.map(t => t.id);
    return employees.filter(e => e.teamId && ledTeamIds.includes(e.teamId));
  }, [isAdmin, employees, visibleTeams, firebaseUser]);

  const handleCheckVerification = async () => {
    if (!auth.currentUser) return;
    setIsCheckingVerification(true);
    try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
            window.location.reload();
        } else {
            notify(settings.language === 'fr' ? "Email non vérifié. Veuillez cliquer sur le lien reçu." : "Email not verified yet. Please click the link.", "error");
        }
    } catch (e) {
        notify("Error checking status.", "error");
    } finally {
        setIsCheckingVerification(false);
    }
  };

  const t = TRANSLATIONS[settings.language];

  if (authLoading || (firebaseUser && (usersLoading || settingsLoading))) {
     return (
        <div className="h-screen flex items-center justify-center bg-gray-50">
            <Loader2 className="animate-spin text-blue-600" size={48} />
        </div>
     );
  }

  if (permissionError) {
      return (
          <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
              <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center border border-red-100">
                  <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                      <AlertTriangle size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Database Access Denied</h2>
                  <p className="text-gray-600 mb-6">
                      Your user is authenticated, but the Firebase Firestore Security Rules are blocking access to the data.
                  </p>
                  <button 
                      onClick={() => window.location.reload()}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                      Reload Page
                  </button>
                  <button 
                      onClick={logout}
                      className="mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                      Log Out
                  </button>
              </div>
          </div>
      );
  }

  if (!firebaseUser) {
      return (
          <>
            <Toast notifications={notifications} />
            <Login onLogin={login} onSignUp={signUp} notify={notify} />
          </>
      );
  }

  if (firebaseUser && !firebaseUser.emailVerified) {
      return (
        <>
        <Toast notifications={notifications} />
        <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                    <Mail size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{t.verify_email_title}</h2>
                <p className="text-gray-600 mb-6">
                    {t.verify_email_desc} <strong>{firebaseUser.email}</strong>.
                    <br/>
                    Please click the link in the email to continue.
                </p>
                <div className="space-y-3">
                    <button 
                        onClick={handleCheckVerification}
                        disabled={isCheckingVerification}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                        {isCheckingVerification && <Loader2 size={16} className="animate-spin" />}
                        {settings.language === 'fr' ? "J'ai vérifié mon email" : "I have verified my email"}
                    </button>
                    <button 
                        onClick={resendVerification}
                        className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                        {t.resend_email}
                    </button>
                    <button 
                        onClick={logout}
                        className="w-full text-gray-500 hover:text-gray-700 text-sm py-2 hover:underline"
                    >
                        {settings.language === 'fr' ? 'Se déconnecter' : 'Log out'}
                    </button>
                </div>
            </div>
        </div>
        </>
      );
  }

  if (!currentUser.active) {
      return (
          <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                  <div className="mx-auto w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
                      <Clock size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Account Pending Approval</h2>
                  <p className="text-gray-600 mb-6">
                      Your email is verified! Your account is now waiting for administrator approval. 
                      Please contact your admin to activate your account.
                  </p>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-500 mb-6">
                      User: <span className="font-medium text-gray-700">{currentUser.email}</span>
                  </div>
                  <button 
                      onClick={logout}
                      className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                  >
                      Back to Login
                  </button>
              </div>
          </div>
      );
  }


  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Toast notifications={notifications} />

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-850 text-white transform transition-transform duration-300 ease-in-out flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-slate-700/50">
          <div className="flex items-center gap-2 text-blue-500">
            <Users size={28} />
            <span className="text-xl font-bold text-white tracking-tight">Team LP</span>
          </div>
          <button 
            className="ml-auto lg:hidden text-slate-400"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Main Navigation">
          <NavItem tab="home" icon={HomeIcon} label={t.home} activeTab={activeTab} setActiveTab={setActiveTab} setIsMobileMenuOpen={setIsMobileMenuOpen} />
          <NavItem tab="dashboard" icon={LayoutDashboard} label={t.dashboard} activeTab={activeTab} setActiveTab={setActiveTab} setIsMobileMenuOpen={setIsMobileMenuOpen} />
          <NavItem tab="employees" icon={Users} label={t.employees} activeTab={activeTab} setActiveTab={setActiveTab} setIsMobileMenuOpen={setIsMobileMenuOpen} />
          <NavItem tab="planning" icon={Calendar} label={t.planning} activeTab={activeTab} setActiveTab={setActiveTab} setIsMobileMenuOpen={setIsMobileMenuOpen} />
          <NavItem tab="training" icon={GraduationCap} label={t.training} activeTab={activeTab} setActiveTab={setActiveTab} setIsMobileMenuOpen={setIsMobileMenuOpen} />
          <NavItem tab="bonus" icon={Award} label={t.bonus} activeTab={activeTab} setActiveTab={setActiveTab} setIsMobileMenuOpen={setIsMobileMenuOpen} />
          
          {isAdmin && (
            <>
              <NavItem tab="users" icon={UserPlus} label={t.users} activeTab={activeTab} setActiveTab={setActiveTab} setIsMobileMenuOpen={setIsMobileMenuOpen} />
              <NavItem tab="audit" icon={ShieldCheck} label={t.audit} activeTab={activeTab} setActiveTab={setActiveTab} setIsMobileMenuOpen={setIsMobileMenuOpen} />
            </>
          )}

          <div className="pt-4 mt-4 border-t border-slate-700/50">
             <NavItem tab="settings" icon={SettingsIcon} label={t.settings} activeTab={activeTab} setActiveTab={setActiveTab} setIsMobileMenuOpen={setIsMobileMenuOpen} />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm text-white" aria-hidden="true">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
            </div>
            <button 
                className="text-slate-400 hover:text-white transition-colors" 
                title={t.logout}
                aria-label={t.logout}
                onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4 lg:hidden sticky top-0 z-30">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <span className="ml-4 font-semibold text-gray-800">Team LP</span>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8" role="main">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'home' && (
              <Home setTab={setActiveTab} lang={settings.language} currentUser={currentUser} />
            )}

            {activeTab === 'dashboard' && (
              <Dashboard 
                employees={visibleEmployees} 
                teams={visibleTeams}
                planning={planning} 
                lang={settings.language}
                settings={settings}
              />
            )}
            
            {activeTab === 'employees' && (
              <EmployeeList 
                employees={visibleEmployees} 
                settings={settings}
                currentUser={currentUser}
                onAdd={addEmployee}
                onUpdate={updateEmployee}
                onDelete={deleteEmployee}
                notify={notify}
              />
            )}

            {activeTab === 'planning' && (
              <Planning 
                employees={visibleEmployees} 
                teams={visibleTeams}
                settings={settings} 
                planning={planning}
                currentUser={currentUser}
                onUpdatePlanning={setPlanningItem}
              />
            )}

            {activeTab === 'training' && (
              <Training 
                trainings={trainings}
                teams={teams}
                employees={employees}
                currentUser={currentUser}
                settings={settings}
                onAdd={addTraining}
                onUpdate={updateTraining}
                onDelete={deleteTraining}
                notify={notify}
              />
            )}

            {activeTab === 'bonus' && (
              <Bonus 
                employees={visibleEmployees}
                teams={visibleTeams}
                bonuses={bonuses}
                settings={settings}
                onUpdateBonus={setBonus}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'users' && isAdmin && (
              <UserList 
                users={users}
                employees={employees}
                lang={settings.language}
                currentUser={currentUser}
                onAddUser={addUser}
                onUpdateUser={updateUser}
                onDeleteUser={deleteUser}
              />
            )}

             {activeTab === 'audit' && isAdmin && (
              <AuditLog 
                logs={logs}
                lang={settings.language}
              />
            )}

            {activeTab === 'settings' && (
              <Settings 
                currentUser={currentUser}
                settings={settings}
                teams={teams} 
                employees={employees} 
                onUpdateSettings={updateSettings}
                onAddTeam={addTeam}
                onUpdateTeam={updateTeam}
                onDeleteTeam={deleteTeam}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
