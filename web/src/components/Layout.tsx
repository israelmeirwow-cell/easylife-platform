import { Outlet } from 'react-router-dom';
import { AmbientBg } from './aether/AmbientBg';
import { TopNav } from './aether/TopNav';

/* App shell per the Claude Design chrome: sticky top bar + horizontally
   scrollable tab row on every screen size. No bottom dock — mobile navigation
   is the scrollable top tabs, exactly as the design specifies. */
export default function Layout() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientBg />
      <TopNav />

      <main className="flex-1 px-4 pb-10 pt-5 md:px-8 md:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
