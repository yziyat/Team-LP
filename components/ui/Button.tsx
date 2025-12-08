
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  icon: Icon, 
  className = '', 
  fullWidth = false,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-sm";
  
  const sizeStyles = {
    xs: "px-2 py-1 text-xs",
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base"
  };

  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 hover:shadow-blue-300",
    secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 shadow-none border-transparent"
  };

  const iconSize = size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'lg' ? 20 : 18;

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {Icon && <Icon size={iconSize} />}
      {children}
    </button>
  );
};
