
import React from 'react';
import { TabName } from '../types';

interface NavItemProps {
  tab: TabName;
  activeTab: TabName;
  setActiveTab: (t: TabName) => void;
  setIsMobileMenuOpen: (o: boolean) => void;
  icon: any;
  label: string;
}

export const NavItem: React.FC<NavItemProps> = ({ 
  tab, 
  activeTab, 
  setActiveTab, 
  setIsMobileMenuOpen, 
  icon: Icon, 
  label 
}) => (
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
