import { NavLink, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { useMe } from '../lib/session';

export function CustomerShell() {
  const { t } = useTranslation();
  const me = useMe();
  const loc = useLocation();
  const hideNav = loc.pathname === '/' && !me.data;
  const tabs = [
    { to: '/', icon: 'home', label: t('nav.home'), end: true },
    { to: '/explore', icon: 'search', label: t('nav.explore') },
    { to: '/qr', icon: 'qr', label: t('nav.qr'), big: true },
    { to: '/rewards', icon: 'gift', label: t('nav.rewards') },
    { to: '/profile', icon: 'user', label: t('nav.profile') },
  ];
  return (
    <div className="min-h-dvh bg-bg">
      <main className={`mx-auto max-w-md min-h-dvh ${hideNav ? '' : 'pb-28'}`}>
        <Outlet />
      </main>
      {!hideNav && (
        <nav className="fixed bottom-0 inset-x-0 z-40 no-print" aria-label="Main">
          <div className="mx-auto max-w-md px-3 pb-[max(env(safe-area-inset-bottom),10px)]">
            <div className="flex items-end justify-between bg-surface/95 backdrop-blur rounded-[24px] shadow-[var(--shadow-lg)] px-2 py-1.5 border border-line">
              {tabs.map((tab) => (
                <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-1.5 min-h-[52px] rounded-2xl text-[11px] font-semibold ${isActive ? 'text-ink' : 'text-ink2'}`}>
                  {({ isActive }) =>
                    tab.big ? (
                      <>
                        <span className="w-12 h-12 -mt-6 rounded-2xl bg-ink text-white grid place-items-center shadow-[var(--shadow-card)]"><Icon name={tab.icon} size={24} /></span>
                        <span>{tab.label}</span>
                      </>
                    ) : (
                      <>
                        <Icon name={tab.icon} size={24} stroke={isActive ? 2.2 : 1.75} />
                        <span>{tab.label}</span>
                      </>
                    )
                  }
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
