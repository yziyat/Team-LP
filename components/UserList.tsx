
import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, Edit2, Link as LinkIcon } from 'lucide-react';
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
  
  // Form State
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    role: 'viewer' as User['role'], 
    employeeId: '' as string 
  });

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId ? String(user.employeeId) : ''
      });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', role: 'viewer', employeeId: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      employeeId: formData.employeeId ? Number(formData.employeeId) : undefined
    };

    if (editingUser) {
      onUpdateUser(editingUser.id, payload);
    } else {
      onAddUser({ ...payload, active: true });
    }
    setIsModalOpen(false);
  };

  const toggleActive = (user: User) => {
    if (currentUser.role === 'admin') {
      onUpdateUser(user.id, { active: !user.active });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.users}</h2>
          <p className="text-gray-500">{lang === 'fr' ? 'Gestion des accès' : 'Access management'}</p>
        </div>
        <Button onClick={() => openModal()} icon={Plus}>
          {lang === 'fr' ? 'Nouvel utilisateur' : 'New User'}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
            {users.map(user => {
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
                <td className="px-6 py-3 text-xs text-gray-600">{user.email}</td>
                <td className="px-6 py-3">
                   <span className="capitalize text-xs font-medium px-2 py-0.5 bg-gray-100 rounded text-gray-700">{user.role}</span>
                </td>
                <td className="px-6 py-3">
                  <button 
                    disabled={currentUser.role !== 'admin'}
                    onClick={() => toggleActive(user)}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${user.active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-500 border-gray-200'} ${currentUser.role === 'admin' ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {user.active ? <CheckCircle size={10} /> : <XCircle size={10} />}
                    {user.active ? (lang === 'fr' ? 'Actif' : 'Active') : (lang === 'fr' ? 'Inactif' : 'Inactive')}
                  </button>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => openModal(user)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                      title={t.edit}
                    >
                      <Edit2 size={14} />
                    </button>
                    {currentUser.role === 'admin' && (
                      <button 
                        onClick={() => { if(window.confirm(t.delete + '?')) onDeleteUser(user.id) }} 
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        title={t.delete}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom / Name</label>
            <input required type="text" className="w-full px-3 py-2 border rounded-lg" 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
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
              <option value="manager">Manager (Team Leader)</option>
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
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>{t.cancel}</Button>
            <Button type="submit">{editingUser ? t.update : t.add}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
