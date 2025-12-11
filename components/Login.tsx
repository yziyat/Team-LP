
import React, { useState } from 'react';
import { Lock, Mail, Loader2, Users } from 'lucide-react';
import { auth } from '../services/firebase';
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';

interface LoginProps {
  onLogin: (email: string, pass: string) => Promise<boolean>;
  onSignUp: (email: string, pass: string) => Promise<boolean>;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onSignUp }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        if (!isSignUp) {
            // Set persistence before login
            await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
            await onLogin(email, password);
        } else {
            // Persistence is typically session or local default for new accounts, 
            // but we can set it here too if needed.
            await onSignUp(email, password);
        }
    } catch (e) {
        console.error("Auth Error", e);
    }
    
    setIsLoading(false);
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
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            required
                            type="email" 
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            required
                            type="password" 
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                {!isSignUp && (
                    <div className="flex items-center">
                        <input
                            id="remember-me"
                            name="remember-me"
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
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
                    onClick={() => { setIsSignUp(!isSignUp); setEmail(''); setPassword(''); }}
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
