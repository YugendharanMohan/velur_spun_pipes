import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useERPStore } from '@/lib/store';
import { LayoutDashboard, Users, Package, FileText, LogOut, Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { title: 'Customers', icon: Users, href: '/customers' },
  { title: 'Inventory', icon: Package, href: '/inventory' },
  { title: 'Sales / Billing', icon: FileText, href: '/sales' },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/customers': 'Customers',
  '/inventory': 'Inventory',
  '/sales': 'Sales & Billing',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { fetchInventory, fetchCustomers } = useERPStore();

  useEffect(() => {
    fetchInventory();
    fetchCustomers();
  }, [fetchInventory, fetchCustomers]);

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  return (
    <div className="flex min-h-screen w-full">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 lg:relative',
        'bg-[hsl(215,28%,17%)] text-[hsl(214,32%,91%)]',
        collapsed ? 'w-[72px]' : 'w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex h-16 items-center gap-3 border-b border-[hsl(215,25%,27%)] px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            VSP
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-white truncate">Velur Spun Pipes</h1>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'text-[hsl(214,32%,75%)] hover:bg-[hsl(215,25%,27%)] hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[hsl(215,25%,27%)] px-3 py-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[hsl(214,32%,75%)] hover:bg-[hsl(215,25%,27%)] hover:text-white transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6 shadow-sm">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden rounded-lg p-2 hover:bg-muted">
            <Menu className="h-5 w-5" />
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex rounded-lg p-2 hover:bg-muted">
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">{pageTitles[location.pathname] || 'Velur Spun Pipes'}</h2>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/sales">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Sale</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">
                  {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-none">{user?.name || 'Admin'}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
