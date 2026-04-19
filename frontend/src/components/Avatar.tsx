interface Props {
  name: string;
  avatarUrl?: string;
  avatarStyle?: AvatarStyle;
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean;
  isFolded?: boolean;
}

export type AvatarStyle =
  | 'adventurer'
  | 'avataaars'
  | 'big-ears'
  | 'bottts'
  | 'croodles'
  | 'fun-emoji'
  | 'lorelei'
  | 'micah'
  | 'miniavs'
  | 'personas';

export const AVATAR_STYLES: { value: AvatarStyle; label: string }[] = [
  { value: 'adventurer', label: 'Adventurer' },
  { value: 'avataaars', label: 'Avataaars' },
  { value: 'big-ears', label: 'Big Ears' },
  { value: 'bottts', label: 'Robots' },
  { value: 'croodles', label: 'Croodles' },
  { value: 'fun-emoji', label: 'Emoji' },
  { value: 'lorelei', label: 'Lorelei' },
  { value: 'micah', label: 'Micah' },
  { value: 'miniavs', label: 'Miniavs' },
  { value: 'personas', label: 'Personas' },
];

export function dicebearUrl(name: string, style: AvatarStyle = 'adventurer'): string {
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundColor=1a1a2e`;
}

const COLORS = [
  'from-purple-500 to-blue-600', 'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-600', 'from-pink-500 to-rose-600',
  'from-yellow-500 to-amber-600', 'from-cyan-500 to-blue-600',
];

function colorFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % COLORS.length;
  return COLORS[Math.abs(h)];
}

export function Avatar({ name, avatarUrl, avatarStyle, size = 'md', isActive, isFolded }: Props) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-xl' : 'w-12 h-12 text-sm';
  const ring = isActive ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-900' : '';
  const opacity = isFolded ? 'opacity-40' : '';

  const src = avatarUrl || dicebearUrl(name, avatarStyle ?? 'adventurer');

  return (
    <div className={`${dim} ${ring} ${opacity} rounded-full overflow-hidden flex-shrink-0 transition-all bg-gray-800`}>
      <img
        src={src}
        alt={name}
        className="w-full h-full object-cover"
        onError={(e) => {
          // fallback to initials if image fails
          const el = e.currentTarget;
          el.style.display = 'none';
          const parent = el.parentElement!;
          parent.classList.add('flex', 'items-center', 'justify-center', 'text-white', 'font-bold', `bg-gradient-to-br`, colorFor(name));
          parent.textContent = name.slice(0, 2).toUpperCase();
        }}
      />
    </div>
  );
}
