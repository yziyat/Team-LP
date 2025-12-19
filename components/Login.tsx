
import React, { useState, useEffect } from 'react';
import { Lock, Mail, Loader2, Users, User } from 'lucide-react';
import { auth } from '../services/firebase';
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';

interface LoginProps {
  onLogin: (email: string, pass: string) => Promise<boolean>;
  onSignUp: (email: string, pass: string, firstName?: string, lastName?: string) => Promise<boolean>;
  notify: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onSignUp, notify }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    // Default to true if not specified
    const stored = localStorage.getItem('team_lp_remember');
    return stored === null ? true : stored === 'true';
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('team_lp_email');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        if (!isSignUp) {
            // CRITICAL: Set persistence BEFORE login
            await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
            
            const success = await onLogin(email, password);
            if (success) {
                // Save user preference for email and checkbox
                localStorage.setItem('team_lp_remember', String(rememberMe));
                if (rememberMe) {
                    localStorage.setItem('team_lp_email', email);
                } else {
                    localStorage.removeItem('team_lp_email');
                }
            } else {
                setPassword(''); // Clear password on failure
            }
        } else {
            // Validation: Empty Fields
            if (!firstName.trim() || !lastName.trim()) {
                notify("Please enter your First Name and Last Name.", 'error');
                setIsLoading(false);
                return;
            }

            // Validation: Password Match
            if (password !== confirmPassword) {
                notify("Passwords do not match. Please try again.", 'error');
                setIsLoading(false);
                return;
            }

            // Validation: Password Length (Frontend check)
            if (password.length < 6) {
                notify("Password must be at least 6 characters long.", 'error');
                setIsLoading(false);
                return;
            }

            const success = await onSignUp(email, password, firstName, lastName);
             if (!success) {
                // Keep the email, but clear passwords
                setPassword('');
                setConfirmPassword('');
            }
        }
    } catch (e) {
        console.error("Auth Error", e);
        notify("An unexpected error occurred. Please try again.", 'error');
        setPassword('');
    }
    
    setIsLoading(false);
  };

  const toggleMode = () => {
      setIsSignUp(!isSignUp);
      // Don't clear email if we are toggling back to login and it was remembered
      if (isSignUp) {
          const remembered = localStorage.getItem('team_lp_email');
          setEmail(remembered || '');
      } else {
          setEmail('');
      }
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-slate-850 px-8 py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 text-white mb-4 shadow-lg shadow-blue-900/50">
               <Users size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Team LP</h1>
            <p className="text-blue-200 mt-1">
                {isSignUp ? 'Create your account' : 'Sign in to your dashboard'}
            </p>
        </div>
        
        <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    id="firstName"
                                    required={isSignUp}
                                    type="text" 
                                    autoComplete="given-name"
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                    placeholder=""
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    id="lastName"
                                    required={isSignUp}
                                    type="text" 
                                    autoComplete="family-name"
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                    placeholder=""
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
                        <input 
                            id="email"
                            required
                            type="email" 
                            autoComplete="username"
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>
                
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
                        <input 
                            id="password"
                            required
                            type="password"
                            autoComplete={isSignUp ? "new-password" : "current-password"}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                {isSignUp && (
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
                            <input 
                                id="confirmPassword"
                                required={isSignUp}
                                type="password"
                                autoComplete="new-password"
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {!isSignUp && (
                    <div className="flex items-center">
                        <input
                            id="remember-me"
                            name="remember-me"
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 select-none cursor-pointer">
                            Remember me
                        </label>
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold shadow-md shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
                </button>
            </form>
            <div className="text-center mt-6">
                <button 
                    type="button"
                    onClick={toggleMode}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                    {isSignUp 
                        ? 'Already have an account? Sign In' 
                        : 'Need an account? Create one'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
