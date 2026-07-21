import { Outlet } from 'react-router-dom';
import { AmbientBg } from './aether/AmbientBg';
import { TopNav } from './aether/TopNav';
import { Dock } from './aether/Dock';

export default function Layout() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientBg />
      <TopNav />

      <main className="flex-1 px-4 pb-32 pt-6 md:px-8 md:pt-8">
        <Outlet />
      </main>

      <Dock />
    </div>
  );
}
