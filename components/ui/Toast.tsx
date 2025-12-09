
import React from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { Notification } from '../../types';

interface ToastProps {
  notifications: Notification[];
}

export const Toast: React.FC<ToastProps> = ({ notifications }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`
            flex items-center gap-3 p-4 rounded-lg shadow-lg border animate-in slide-in-from-top-2 fade-in
            ${n.type === 'success' ? 'bg-white border-green-200 text-green-800' : ''}
            ${n.type === 'error' ? 'bg-white border-red-200 text-red-800' : ''}
            ${n.type === 'info' ? 'bg-white border-blue-200 text-blue-800' : ''}
          `}
        >
          {n.type === 'success' && <CheckCircle size={20} className="text-green-500" />}
          {n.type === 'error' && <XCircle size={20} className="text-red-500" />}
          {n.type === 'info' && <Info size={20} className="text-blue-500" />}
          
          <p className="text-sm font-medium flex-1">{n.message}</p>
        </div>
      ))}
    </div>
  );
};
