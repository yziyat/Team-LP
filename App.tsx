
import React, { useState, useEffect } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { useDataStore } from './services/storage';
import { Home } from './components/Home';
import { Dashboard } from './components/Dashboard';
import { EmployeeList } from './components/EmployeeList';
import { Planning } from './components/Planning';
import { Settings } from './components/Settings';
import { UserList } from './components/UserList';
import { Bonus } from './components/Bonus';
import { AuditLog } from './components/AuditLog';
import { Toast } from './components/ui/Toast';
import { TabName, User } from './types';
import { TRANSLATIONS } from './constants';

function App() {
  const { 
    employees, teams, users, settings, planning, bonuses, logs, notifications,
    addEmployee, updateEmployee, deleteEmployee,
    updateSettings, addTeam, updateTeam, deleteTeam,
    setPlanningItem, addUser, updateUser, deleteUser,
    setBonus, notify
  } = useDataStore();

  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // MOCK AUTH STATE for Demo Purposes
  // In a real app, this would come from a login context
  // For now, we select the first "admin" user found, or default to a dummy object
  const currentUser: User = users.find(u => u.role === 'admin' && u.active) || users[0] || { 
    id: 0, 
    name: 'Admin', 
    email: 'admin@system.local',
    role: 'admin', 
    active: true 
  };

  const t = TRANSLATIONS[settings.language];

  const NavItem = ({ tab, icon: Icon, label }: { tab: TabName; icon: any; label: string }) => (
    <button
      onClick={() => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm ${
        activeTab === tab 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Toast notifications={notifications} />

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
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
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem tab="home" icon={HomeIcon} label={t.home} />
          <NavItem tab="dashboard" icon={LayoutDashboard} label={t.dashboard} />
          <NavItem tab="employees" icon={Users} label={t.employees} />
          <NavItem tab="planning" icon={Calendar} label={t.planning} />
          <NavItem tab="bonus" icon={Award} label={t.bonus} />
          <NavItem tab="users" icon={UserPlus} label={t.users} />
           <NavItem tab="audit" icon={ShieldCheck} label={t.audit} />
          <div className="pt-4 mt-4 border-t border-slate-700/50">
             <NavItem tab="settings" icon={SettingsIcon} label={t.settings} />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-400 truncate capitalize">{currentUser.role}</p>
            </div>
            <button className="text-slate-400 hover:text-white transition-colors" title={t.logout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4 lg:hidden sticky top-0 z-30">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <span className="ml-4 font-semibold text-gray-800">Team LP</span>
        </header>

        {/* Main Scroll Area */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'home' && (
              <Home setTab={setActiveTab} lang={settings.language} />
            )}

            {activeTab === 'dashboard' && (
              <Dashboard 
                employees={employees} 
                planning={planning} 
                lang={settings.language}
              />
            )}
            
            {activeTab === 'employees' && (
              <EmployeeList 
                employees={employees} 
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
                employees={employees} 
                teams={teams}
                settings={settings} 
                planning={planning}
                currentUser={currentUser}
                onUpdatePlanning={setPlanningItem}
              />
            )}

            {activeTab === 'bonus' && (
              <Bonus 
                employees={employees}
                teams={teams}
                bonuses={bonuses}
                settings={settings}
                onUpdateBonus={setBonus}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'users' && (
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

             {activeTab === 'audit' && (
              <AuditLog 
                logs={logs}
                lang={settings.language}
              />
            )}

            {activeTab === 'settings' && (
              <Settings 
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
