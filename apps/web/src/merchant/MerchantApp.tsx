import { Navigate, NavLink, Outlet, Route, Routes, useParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useMe } from '../lib/session';
import { Icon, ShopGlyph } from '../components/Icon';
import { Card, ErrorBox, LinkButton, Loading, PageTitle, Pill } from '../components/ui';
import type { MerchantV } from '../lib/types';
import { LangSwitch } from '../customer/Landing';
import Onboarding from './Onboarding';
import Dashboard from './Dashboard';
import Counter from './Counter';
import Offers from './Offers';
import OfferBuilder from './OfferBuilder';
import MerchantOffer from './MerchantOffer';
import Pool from './Pool';
import Customers from './Customers';
import Settings from './Settings';
import Poster from './Poster';

export function useMerchant() {
  const { mid } = useParams();
  return useQuery<{ merchant: MerchantV }>({ queryKey: ['merchant', mid], queryFn: () => api.get(`/m/${mid}`), enabled: !!mid });
}

function Entry() {
  const { t } = useTranslation();
  const me = useMe();
  const ms = me.data?.memberships ?? [];
  if (ms.length === 1) return <Navigate to={`/m/${ms[0].merchantId}`} replace />;
  if (ms.length === 0) return <Navigate to="/merchant/new" replace />;
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title={t('m.yourShops')} back="/profile" />
      <div className="px-5 space-y-3">
        {ms.map((m) => (
          <Link key={m.merchantId} to={`/m/${m.merchantId}`} className="block">
            <Card className="p-4 flex items-center gap-3">
              <ShopGlyph category="other" />
              <div className="flex-1"><div className="font-bold">{m.name}</div><div className="text-xs text-ink2">{t(`m.role.${m.role}`)}</div></div>
              <Icon name="chevron" />
            </Card>
          </Link>
        ))}
        <LinkButton to="/merchant/new" variant="secondary" full icon="plus">{t('m.addShop')}</LinkButton>
      </div>
    </div>
  );
}

function Shell() {
  const { t } = useTranslation();
  const q = useMerchant();
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const m = q.data!.merchant;
  const base = `/m/${m.id}`;
  const staff = m.role === 'staff';
  const nav = [
    { to: base, icon: 'home', label: t('m.nav.dashboard'), end: true, hide: staff },
    { to: `${base}/counter`, icon: 'scan', label: t('m.nav.counter') },
    { to: `${base}/offers`, icon: 'tag', label: t('m.nav.offers'), hide: staff },
    { to: `${base}/pool`, icon: 'wallet', label: t('m.nav.pool'), hide: staff },
    { to: `${base}/customers`, icon: 'users', label: t('m.nav.customers') },
    { to: `${base}/settings`, icon: 'settings', label: t('m.nav.settings'), hide: staff },
  ].filter((n) => !n.hide);
  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden md:flex w-64 shrink-0 bg-ink text-white flex-col p-4 sticky top-0 h-dvh no-print">
        <Link to="/" className="flex items-center gap-2 px-2 py-2"><img src="/icon.svg" alt="" width={30} height={30} className="rounded-[9px]" /><span className="font-bold">LoyalLink</span><Pill tone="accent" className="ml-1">{t('m.forShops')}</Pill></Link>
        <div className="mt-6 px-2">
          <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">{t('m.shop')}</div>
          <div className="font-semibold mt-1 truncate">{m.name}</div>
        </div>
        <nav className="mt-4 space-y-1" aria-label="Shop">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-semibold ${isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5'}`}>
              <Icon name={n.icon} size={20} />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <Link to="/" className="flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-semibold text-white/70 hover:bg-white/5"><Icon name="user" size={20} />{t('m.customerApp')}</Link>
        </div>
      </aside>
      <div className="flex-1 min-w-0 pb-24 md:pb-8">
        <header className="md:hidden flex items-center gap-3 px-5 pt-4 no-print">
          <Link to="/" aria-label="LoyalLink"><img src="/icon.svg" alt="" width={30} height={30} className="rounded-[9px]" /></Link>
          <div className="flex-1 min-w-0 font-bold truncate">{m.name}</div>
          <LangSwitch />
        </header>
        {m.status !== 'approved' && (
          <div className={`mx-5 md:mx-8 mt-4 p-4 rounded-2xl text-sm flex gap-3 ${m.status === 'rejected' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'}`} role="status">
            <Icon name={m.status === 'rejected' ? 'alert' : 'clock'} />
            <div><b>{t(`m.status.${m.status}`)}</b><div className="mt-0.5">{m.status === 'rejected' ? m.rejectionReason : t('m.pendingBody')}</div></div>
          </div>
        )}
        {m.frozen && <div className="mx-5 md:mx-8 mt-4 p-4 rounded-2xl text-sm bg-danger-soft text-danger font-semibold">{t('m.frozen')}</div>}
        <div className="md:px-3 max-w-5xl">
          <Outlet context={m} />
        </div>
      </div>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)] no-print" aria-label="Shop">
        <div className="flex">
          {nav.slice(0, 5).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex-1 flex flex-col items-center gap-0.5 py-2 min-h-14 text-[11px] font-semibold ${isActive ? 'text-ink' : 'text-ink2'}`}>
              <Icon name={n.icon} size={22} />{n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function MerchantApp() {
  return (
    <Routes>
      <Route path="/" element={<Entry />} />
      <Route path="/new" element={<Onboarding />} />
      <Route path="/:mid/poster" element={<Poster />} />
      <Route path="/:mid" element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="counter" element={<Counter />} />
        <Route path="offers" element={<Offers />} />
        <Route path="offers/new" element={<OfferBuilder />} />
        <Route path="offers/:oid" element={<MerchantOffer />} />
        <Route path="pool" element={<Pool />} />
        <Route path="customers" element={<Customers />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Outlet />} />
    </Routes>
  );
}
