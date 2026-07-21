import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './TopNav';

export function Dock() {
  const items = NAV_ITEMS.slice(0, 5);
  return (
    <motion.nav
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-3 bottom-3 z-50 flex items-stretch justify-around rounded-2xl border border-white/10 bg-white/5 px-1 py-1.5 backdrop-blur-2xl md:hidden"
      style={{
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
        paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))',
      }}
      aria-label="ניווט תחתון"
    >
      {items.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] transition-colors ${
              isActive ? 'text-cyan-300' : 'text-white/50'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  className="absolute -top-0.5 h-1 w-1 rounded-full bg-cyan-300"
                  style={{ boxShadow: '0 0 8px #7ff0ff' }}
                />
              )}
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </motion.nav>
  );
}
