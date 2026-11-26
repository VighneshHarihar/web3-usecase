import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Loading } from './components/ui';
import { useMe } from './lib/session';
import { CustomerShell } from './customer/Shell';
import Landing from './customer/Landing';
import Login from './customer/Login';
import Home from './customer/Home';
import Explore from './customer/Explore';
import OfferDetail from './customer/OfferDetail';
import ShopPage from './customer/ShopPage';
const QrScreen = lazy(() => import('./customer/QrScreen'));
import Progress from './customer/Progress';
import Rewards from './customer/Rewards';
import Activity from './customer/Activity';
import Alerts from './customer/Alerts';
import Profile from './customer/Profile';
import HowItWorks from './customer/HowItWorks';

const MerchantApp = lazy(() => import('./merchant/MerchantApp'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const ProofApp = lazy(() => import('./proof/ProofApp'));
const PayPage = lazy(() => import('./merchant/PayPage'));

export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const loc = useLocation();
  if (me.isLoading) return <Loading />;
  if (!me.data) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

function HomeOrLanding() {
  const me = useMe();
  if (me.isLoading) return <Loading />;
  return me.data ? <Home /> : <Landing />;
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/merchant/*" element={<RequireAuth><MerchantApp /></RequireAuth>} />
        <Route path="/m/*" element={<RequireAuth><MerchantApp /></RequireAuth>} />
        <Route path="/pay/:id" element={<RequireAuth><PayPage /></RequireAuth>} />
        <Route path="/admin/*" element={<RequireAuth><AdminApp /></RequireAuth>} />
        <Route path="/proof/*" element={<ProofApp />} />
        <Route element={<CustomerShell />}>
          <Route path="/" element={<HomeOrLanding />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/offer/:id" element={<OfferDetail />} />
          <Route path="/s/:slug" element={<ShopPage />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/qr" element={<RequireAuth><QrScreen /></RequireAuth>} />
          <Route path="/progress/:id" element={<RequireAuth><Progress /></RequireAuth>} />
          <Route path="/rewards" element={<RequireAuth><Rewards /></RequireAuth>} />
          <Route path="/activity" element={<RequireAuth><Activity /></RequireAuth>} />
          <Route path="/alerts" element={<RequireAuth><Alerts /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
