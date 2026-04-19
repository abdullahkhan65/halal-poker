import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { useNavigate } from 'react-router-dom';

type Step = 'email' | 'link-sent' | 'verify';

export function LoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  async function sendLink() {
    setLoading(true); setError('');
    try {
      await api.auth.sendMagicLink(email);
      setStep('link-sent');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function verify() {
    setLoading(true); setError('');
    try {
      const { accessToken, user } = await api.auth.verify(token, isNew ? inviteCode : undefined);
      setAuth(user, accessToken);
      nav('/');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🃏</div>
          <h1 className="text-2xl font-bold text-yellow-400">Halal Poker</h1>
          <p className="text-gray-400 text-sm mt-1">Private • Invite Only</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">
            {error}
          </div>
        )}

        {step === 'email' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendLink()}
                placeholder="you@example.com"
                className="w-full mt-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition"
              />
            </div>
            <button
              onClick={sendLink}
              disabled={!email || loading}
              className="w-full py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </div>
        )}

        {step === 'link-sent' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl mb-2">📧</div>
              <p className="text-gray-300">Check your email. Click the link, copy the token from the URL, and paste it below.</p>
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wide">Token from link</label>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token here"
                className="w-full mt-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition font-mono text-xs"
              />
            </div>
            <label className="flex items-center gap-2 text-gray-400 text-sm cursor-pointer">
              <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="accent-yellow-500" />
              I'm a new player (need invite code)
            </label>
            {isNew && (
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide">Invite Code</label>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C"
                  className="w-full mt-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition font-mono tracking-widest"
                />
              </div>
            )}
            <button
              onClick={verify}
              disabled={!token || loading}
              className="w-full py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Enter the Game'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
