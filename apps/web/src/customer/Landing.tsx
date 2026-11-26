import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { LinkButton } from '../components/ui';
import { setLanguage } from '../i18n';

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src="/icon.svg" alt="" width={32} height={32} className="rounded-[10px]" />
      <span className={`font-bold text-lg tracking-tight ${light ? 'text-white' : ''}`}>LoyalLink</span>
    </div>
  );
}

export function LangSwitch() {
  const { i18n } = useTranslation();
  return (
    <button onClick={() => setLanguage(i18n.language === 'hi' ? 'en' : 'hi')} className="h-10 px-3 rounded-full bg-alt text-sm font-semibold inline-flex items-center gap-1.5" aria-label="Change language">
      <Icon name="globe" size={16} /> {i18n.language === 'hi' ? 'English' : 'हिन्दी'}
    </button>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const steps = [
    { icon: 'search', title: t('landing.step1'), body: t('landing.step1b') },
    { icon: 'shield', title: t('landing.step2'), body: t('landing.step2b') },
    { icon: 'qr', title: t('landing.step3'), body: t('landing.step3b') },
    { icon: 'gift', title: t('landing.step4'), body: t('landing.step4b') },
  ];
  return (
    <div className="px-5 pt-5 pb-10">
      <header className="flex items-center justify-between">
        <Logo />
        <LangSwitch />
      </header>

      <section className="mt-10">
        <h1 className="text-[34px] leading-[1.08] font-bold tracking-[-0.03em]">{t('landing.title')}</h1>
        <p className="text-ink2 text-[17px] mt-4 leading-relaxed">{t('landing.sub')}</p>
        <div className="mt-7 flex flex-col gap-3">
          <LinkButton to="/login" size="lg" full icon="user">{t('landing.cta')}</LinkButton>
          <LinkButton to="/explore" size="lg" variant="secondary" full icon="search">{t('landing.browse')}</LinkButton>
        </div>
        <p className="text-xs text-ink2 mt-3 text-center">{t('landing.free')}</p>
      </section>

      <section className="mt-10 rounded-[28px] bg-ink text-white p-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-accent/25 blur-md" />
        <div className="text-[11px] uppercase tracking-widest text-white/60 font-semibold">{t('landing.exampleLabel')}</div>
        <div className="text-xl font-bold mt-2 leading-snug pr-8">{t('landing.example')}</div>
        <div className="flex gap-1.5 mt-4">
          {[1, 1, 0].map((f, i) => <div key={i} className={`h-2.5 flex-1 rounded-full ${f ? 'bg-accent' : 'bg-white/15'}`} />)}
        </div>
        <div className="flex justify-between mt-3 text-xs">
          <span className="text-white/70">{t('landing.exampleProgress')}</span>
          <span className="text-[#9ED5B0] font-semibold inline-flex items-center gap-1"><Icon name="check" size={13} stroke={2.6} />{t('trust.secured')}</span>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">{t('landing.howTitle')}</h2>
        <ol className="mt-4 space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-alt grid place-items-center shrink-0"><Icon name={s.icon} /></div>
              <div>
                <div className="font-semibold">{s.title}</div>
                <div className="text-sm text-ink2 mt-0.5 leading-relaxed">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 rounded-[24px] bg-accent-soft p-5">
        <div className="flex items-center gap-2 text-accent-ink font-bold"><Icon name="store" />{t('landing.shopTitle')}</div>
        <p className="text-sm text-accent-ink/90 mt-2 leading-relaxed">{t('landing.shopBody')}</p>
        <LinkButton to="/login?next=/merchant" variant="primary" className="mt-4" icon="store">{t('landing.shopCta')}</LinkButton>
      </section>

      <footer className="mt-10 text-xs text-ink2 flex flex-wrap gap-x-4 gap-y-2 justify-center">
        <Link to="/how-it-works" className="underline">{t('landing.howLink')}</Link>
        <Link to="/proof" className="underline">{t('landing.ledgerLink')}</Link>
        <a href="https://github.com/vighneshharihar/web3-usecase" className="underline">{t('landing.openSource')}</a>
      </footer>
    </div>
  );
}
