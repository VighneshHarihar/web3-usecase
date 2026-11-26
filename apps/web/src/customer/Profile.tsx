import { useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errMsg } from '../lib/api';
import { useLogout, useMe } from '../lib/session';
import { setLanguage } from '../i18n';
import { Icon } from '../components/Icon';
import { Button, Card, Confirm, Field, Input, PageTitle, Segmented, useToast } from '../components/ui';

function Row({ icon, label, to, onClick, danger }: { icon: string; label: string; to?: string; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <Icon name={icon} size={20} className={danger ? 'text-danger' : 'text-ink2'} />
      <span className={`flex-1 font-medium ${danger ? 'text-danger' : ''}`}>{label}</span>
      <Icon name="chevron" size={18} className="text-ink2" />
    </>
  );
  const cls = 'flex items-center gap-3 px-4 min-h-14 w-full text-left';
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
}

export default function Profile() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const logout = useLogout();
  const [name, setName] = useState(me.data?.user.name ?? '');
  const [del, setDel] = useState(false);
  const u = me.data!.user;

  async function saveName() {
    await api.patch('/me', { name });
    qc.invalidateQueries({ queryKey: ['me'] });
    toast(t('profile.saved'));
  }
  async function changeLang(l: 'en' | 'hi') {
    setLanguage(l);
    await api.patch('/me', { locale: l }).catch(() => undefined);
  }
  async function download() {
    const data = await api.get('/me/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'loyallink-my-data.json' });
    a.click();
    URL.revokeObjectURL(url);
  }
  async function deleteAccount() {
    try {
      await api.del('/me');
      qc.clear();
      window.location.href = '/';
    } catch (e) {
      toast(errMsg(e), 'error');
      setDel(false);
    }
  }

  return (
    <div>
      <PageTitle title={t('profile.title')} sub={`${u.phone.slice(0, 3)} ${u.phone.slice(3, 8)} ${u.phone.slice(8)}`} />
      <div className="px-5 space-y-5">
        <Card className="p-4 space-y-3">
          <Field label={t('login.name')}>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <Button variant="soft" onClick={saveName} disabled={!name.trim() || name === u.name}>{t('common.save')}</Button>
            </div>
          </Field>
          <div>
            <div className="text-sm font-semibold mb-1.5">{t('profile.language')}</div>
            <Segmented value={i18n.language === 'hi' ? 'hi' : 'en'} onChange={changeLang} options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिन्दी' }]} />
          </div>
        </Card>

        <Card className="divide-y divide-line overflow-hidden">
          <Row icon="receipt" label={t('profile.activity')} to="/activity" />
          <Row icon="bell" label={t('alerts.title')} to="/alerts" />
          <Row icon="shield" label={t('profile.how')} to="/how-it-works" />
          <Row icon="store" label={me.data!.memberships.length ? t('profile.myShop') : t('profile.ownShop')} to="/merchant" />
          {u.isAdmin && <Row icon="settings" label={t('profile.admin')} to="/admin" />}
        </Card>

        <Card className="divide-y divide-line overflow-hidden">
          <Row icon="download" label={t('profile.download')} onClick={download} />
          <Row icon="logout" label={t('profile.logout')} onClick={logout} />
          <Row icon="trash" label={t('profile.delete')} onClick={() => setDel(true)} danger />
        </Card>
        <p className="text-xs text-ink2 text-center leading-relaxed px-4">{t('profile.lostPhone')}</p>
      </div>
      <Confirm open={del} onClose={() => setDel(false)} title={t('profile.deleteTitle')} body={t('profile.deleteBody')} confirmLabel={t('profile.deleteConfirm')} danger onConfirm={deleteAccount} />
    </div>
  );
}
