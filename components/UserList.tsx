
import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, Edit2, Link as LinkIcon, UserCheck } from 'lucide-react';
import { User, AppSettings, Employee } from '../types';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { TRANSLATIONS } from '../constants';

interface UserListProps {
  users: User[];
  employees: Employee[];
  lang: AppSettings['language'];
  currentUser: User; // To check if admin
  onAddUser: (user: Omit<User, 'id'>) => void;
  onUpdateUser: (id: number, data: Partial<User>) => void;
  onDeleteUser: (id: number) => void;
}

export const UserList: React.FC<UserListProps> = ({ users, employees, lang, currentUser, onAddUser, onUpdateUser, onDeleteUser }) => {
  const t = TRANSLATIONS[lang];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  
  // Deletion Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, userId: number | null }>({ isOpen: false, userId: null });
  
  // Form State
  const [formData, setFormData] = useState({ 
    firstName: '',
    lastName: '',
    email: '', 
    role: 'viewer' as User['role'], 
    employeeId: '' as string,
    active: true
  });

  const openModal = (user?: User, forceActiveState?: boolean) => {
    if (user) {
      setEditingUser(user);
      // Split name blindly by first space
      const nameParts = user.name.split(' ');
      const fName = nameParts[0] || '';
      const lName = nameParts.slice(1).join(' ') || '';
      
      setFormData({
        firstName: fName,
        lastName: lName,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId ? String(user.employeeId) : '',
        active: forceActiveState !== undefined ? forceActiveState : user.active
      });
    } else {
      setEditingUser(null);
      setFormData({ 
        firstName: '',
        lastName: '',
        email: '', 
        role: 'viewer', 
        employeeId: '',
        active: true 
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    const payload = {
      name: fullName,
      email: formData.email,
      role: formData.role,
      // Fix: Send null instead of undefined/empty string for Firestore compatibility
      employeeId: formData.employeeId && formData.employeeId !== '' ? Number(formData.employeeId) : null,
      active: formData.active
    };

    if (editingUser) {
      onUpdateUser(editingUser.id, payload);
    } else {
      // Admin created users are trusted
      onAddUser({ ...payload, emailVerified: true });
    }
    setIsModalOpen(false);
  };

  const toggleActive = (user: User) => {
    if (currentUser.role === 'admin') {
      onUpdateUser(user.id, { active: !user.active });
    }
  };

  // Handler for the status badge click
  const handleStatusClick = (user: User) => {
      if (currentUser.role !== 'admin' || !user.emailVerified) return;

      if (!user.active) {
          // If Pending, open modal to allow Role selection and Activation together
          openModal(user, true); // Force active checkbox to true for convenience
      } else {
          // If Active, just toggle to inactive
          toggleActive(user);
      }
  };

  const handleDelete = (id: number) => {
      setDeleteConfirmation({ isOpen: true, userId: id });
  };
  
  const executeDelete = () => {
      if (deleteConfirmation.userId !== null) {
          onDeleteUser(deleteConfirmation.userId);
          setDeleteConfirmation({ isOpen: false, userId: null });
      }
  };

  const renderActions = (user: User) => (
      <div className="flex items-center justify-end gap-2">
        <button 
          onClick={() => openModal(user)}
          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
          title={t.edit}
        >
          <Edit2 size={16} />
        </button>
        {currentUser.role === 'admin' && (
          <button 
            onClick={() => handleDelete(user.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
            title={t.delete}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
  );

  // Filters: Pending includes ONLY those who have verified their email but are not yet active
  const pendingCount = users.filter(u => !u.active && u.emailVerified).length;
  const filteredUsers = filter === 'all' 
    ? users 
    : users.filter(u => !u.active && u.emailVerified);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.users}</h2>
          <p className="text-gray-500">{lang === 'fr' ? 'Gestion des accès' : 'Access management'}</p>
        </div>
        <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                <button 
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'all' ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {t.all}
                </button>
                <button 
                    onClick={() => setFilter('pending')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${filter === 'pending' ? 'bg-orange-50 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Pending
                    {pendingCount > 0 && (
                        <span className="bg-orange-500 text-white text-[10px] px-1.5 rounded-full">{pendingCount}</span>
                    )}
                </button>
            </div>
            
            <Button onClick={() => openModal()} icon={Plus}>
            {lang === 'fr' ? 'Nouvel utilisateur' : 'New User'}
            </Button>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
         {filteredUsers.map(user => {
             const linkedEmployee = employees.find(e => e.id === user.employeeId);
             return (
                 <div key={user.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                     <div className="flex justify-between items-start mb-2">
                         <div>
                             <h4 className="font-semibold text-gray-900">{user.name}</h4>
                             <p className="text-xs text-gray-500">{user.email}</p>
                             {!user.emailVerified && <span className="text-[10px] text-red-500 italic">Email not verified</span>}
                         </div>
                          <button 
                            disabled={currentUser.role !== 'admin' || !user.emailVerified}
                            onClick={() => handleStatusClick(user)}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${user.active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-700 border-orange-100'} ${currentUser.role === 'admin' && user.emailVerified ? 'cursor-pointer hover:shadow-sm' : 'cursor-default opacity-60'}`}
                          >
                            {user.active ? <CheckCircle size={10} /> : <UserCheck size={10} />}
                            {user.active ? (lang === 'fr' ? 'Actif' : 'Active') : (lang === 'fr' ? 'En attente' : 'Pending')}
                          </button>
                     </div>
                     <div className="flex justify-between items-center text-sm text-gray-600 mb-3">
                         <span className="capitalize bg-gray-100 px-2 py-0.5 rounded text-xs">{user.role}</span>
                         {linkedEmployee && (
                            <div className="flex items-center gap-1 text-[10px] text-blue-600">
                                <LinkIcon size={10} />
                                {linkedEmployee.firstName} {linkedEmployee.lastName}
                            </div>
                        )}
                     </div>
                     <div className="border-t pt-2 flex justify-end">
                         {renderActions(user)}
                     </div>
                 </div>
             );
         })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.length === 0 && (
                <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        No users found in this category.
                    </td>
                </tr>
            )}
            {filteredUsers.map(user => {
              const linkedEmployee = employees.find(e => e.id === user.employeeId);
              return (
              <tr key={user.id} className="hover:bg-gray-50/50">
                <td className="px-6 py-3">
                  <div className="font-medium text-sm text-gray-900">{user.name}</div>
                  {linkedEmployee && (
                    <div className="flex items-center gap-1 text-[10px] text-blue-600">
                      <LinkIcon size={10} />
                      {linkedEmployee.firstName} {linkedEmployee.lastName}
                    </div>
                  )}
                </td>
                <td className="px-6 py-3 text-xs text-gray-600">
                    {user.email}
                    {!user.emailVerified && <div className="text-[10px] text-red-500 italic mt-0.5">Not Verified</div>}
                </td>
                <td className="px-6 py-3">
                   <span className="capitalize text-xs font-medium px-2 py-0.5 bg-gray-100 rounded text-gray-700">{user.role}</span>
                </td>
                <td className="px-6 py-3">
                  <button 
                    disabled={currentUser.role !== 'admin' || !user.emailVerified}
                    onClick={() => handleStatusClick(user)}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${user.active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-700 border-orange-100'} ${currentUser.role === 'admin' && user.emailVerified ? 'cursor-pointer hover:shadow-sm' : 'cursor-default opacity-60'}`}
                  >
                    {user.active ? <CheckCircle size={10} /> : <UserCheck size={10} />}
                    {user.active ? (lang === 'fr' ? 'Actif' : 'Active') : (lang === 'fr' ? 'En attente' : 'Pending')}
                  </button>
                </td>
                <td className="px-6 py-3 text-right">
                  {renderActions(user)}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? (lang === 'fr' ? 'Modifier utilisateur' : 'Edit User') : (lang === 'fr' ? 'Ajouter un utilisateur' : 'Add User')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom / First Name</label>
              <input required type="text" className="w-full px-3 py-2 border rounded-lg" 
                value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom / Last Name</label>
              <input required type="text" className="w-full px-3 py-2 border rounded-lg" 
                value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input required type="email" className="w-full px-3 py-2 border rounded-lg" 
              value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select required className="w-full px-3 py-2 border rounded-lg bg-white"
              value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Link to Employee Profile</label>
             <p className="text-xs text-gray-500 mb-2">Required for Team Leaders to see their team.</p>
             <select 
              className="w-full px-3 py-2 border rounded-lg bg-white"
              value={formData.employeeId} 
              onChange={e => setFormData({...formData, employeeId: e.target.value})}
             >
               <option value="">None</option>
               {employees.map(emp => (
                 <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.matricule})</option>
               ))}
             </select>
          </div>
          
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2">
            <input 
                type="checkbox" 
                id="userActive"
                checked={formData.active}
                onChange={e => setFormData({...formData, active: e.target.checked})}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="userActive" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                {lang === 'fr' ? 'Compte Actif (Autoriser la connexion)' : 'Account Active (Allow Login)'}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>{t.cancel}</Button>
            <Button type="submit">{editingUser ? t.update : t.add}</Button>
          </div>
        </form>
      </Modal>

      {/* Deletion Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, userId: null })}
        title={t.delete + '?'}
        size="sm"
      >
          <div className="space-y-4">
              <p className="text-sm text-gray-600">
                  {lang === 'fr' 
                    ? 'Êtes-vous sûr de vouloir supprimer cet utilisateur ?' 
                    : 'Are you sure you want to delete this user?'}
              </p>
              <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setDeleteConfirmation({ isOpen: false, userId: null })}>
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
