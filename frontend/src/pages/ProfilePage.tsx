import { useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';
import type { User } from '../lib/api';
import { Avatar, AVATAR_STYLES, dicebearUrl } from '../components/Avatar';
import type { AvatarStyle } from '../components/Avatar';
import { connectSocket } from '../lib/socket';

export function ProfilePage() {
  const { user, setAuth, token } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>((user as any)?.avatarStyle ?? 'adventurer');
  const [useCustomUrl, setUseCustomUrl] = useState(!!user?.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const previewSrc = useCustomUrl && avatarUrl ? avatarUrl : dicebearUrl(name || user?.name || 'you', avatarStyle);

  async function save() {
    setSaving(true);
    try {
      const payload: Partial<User> & { avatarStyle?: string } = { name };
      if (useCustomUrl && avatarUrl) {
        payload.avatarUrl = avatarUrl;
      } else {
        payload.avatarUrl = undefined;
        (payload as any).avatarStyle = avatarStyle;
      }
      const updated = await api.users.updateMe(payload as any);
      setAuth(updated, token!);
      setMsg('Profile saved!');
      // propagate avatar/name change to any active table in real-time
      try {
        connectSocket().emit('profile_updated', {
          name: updated.name,
          avatarUrl: updated.avatarUrl ?? null,
          avatarStyle: (updated as any).avatarStyle ?? null,
        });
      } catch { /* not connected to a table */ }
    } finally { setSaving(false); }
  }

  if (!user) return null;

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold text-yellow-400">Profile</h2>

      {/* Preview */}
      <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-gray-900 border border-gray-800">
        <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-yellow-500/30 bg-gray-800">
          <img src={previewSrc} alt="preview" className="w-full h-full object-cover" />
        </div>
        <div className="text-center">
          <div className="font-semibold text-white text-lg">{name || user.name}</div>
          <div className={`text-xl font-bold font-mono mt-1 ${user.totalEarnings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {user.totalEarnings > 0 ? '+' : ''}{user.totalEarnings.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Total Earnings</div>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg bg-green-900/30 border border-green-700 text-green-300 text-sm">{msg}</div>
      )}

      <div className="p-5 rounded-xl bg-gray-900 border border-gray-800 space-y-5">
        {/* Name */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">Display Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-yellow-500 transition"
          />
        </div>

        {/* Avatar mode toggle */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Avatar</label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setUseCustomUrl(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!useCustomUrl ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              🎨 Cartoon
            </button>
            <button
              onClick={() => setUseCustomUrl(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${useCustomUrl ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              🔗 Custom URL
            </button>
          </div>

          {!useCustomUrl ? (
            <div>
              <p className="text-xs text-gray-500 mb-2">Pick a style — avatar is auto-generated from your name</p>
              <div className="grid grid-cols-5 gap-2">
                {AVATAR_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setAvatarStyle(s.value)}
                    title={s.label}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition ${
                      avatarStyle === s.value
                        ? 'border-yellow-500 bg-yellow-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                    }`}
                  >
                    <img
                      src={dicebearUrl(name || user.name, s.value)}
                      alt={s.label}
                      className="w-10 h-10 rounded-full bg-gray-700"
                    />
                    <span className="text-[10px] text-gray-400 truncate w-full text-center">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-yellow-500 transition font-mono"
              />
              <p className="text-xs text-gray-600 mt-1">Any public image URL</p>
            </div>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <div className="text-xs text-gray-600 text-center">{user.email}</div>
    </div>
  );
}
