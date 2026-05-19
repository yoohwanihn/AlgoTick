import { Outlet } from 'react-router-dom';
import { Header } from './Header.js';

export function Layout() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
