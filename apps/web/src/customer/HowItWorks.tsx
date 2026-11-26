import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { Card, PageTitle } from '../components/ui';

/** Plain-language trust explainer. Technical words live only behind "For the curious". */
export default function HowItWorks() {
  const { t } = useTranslation();
  const items = ['1', '2', '3', '4', '5'];
  return (
    <div>
      <PageTitle title={t('how.title')} sub={t('how.sub')} back="/" />
      <div className="px-5 space-y-3">
        {items.map((i) => (
          <Card key={i} className="p-4 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-ink text-white grid place-items-center text-sm font-bold shrink-0">{i}</div>
            <div>
              <div className="font-semibold">{t(`how.q${i}`)}</div>
              <div className="text-sm text-ink2 mt-1 leading-relaxed">{t(`how.a${i}`)}</div>
            </div>
          </Card>
        ))}
        <Card tone="alt" className="p-4">
          <div className="font-semibold flex items-center gap-2"><Icon name="shield" className="text-ok" />{t('how.curiousTitle')}</div>
          <p className="text-sm text-ink2 mt-1.5 leading-relaxed">{t('how.curiousBody')}</p>
          <Link to="/proof" className="inline-flex items-center gap-1 text-sm font-semibold mt-3 underline">{t('how.curiousLink')}<Icon name="external" size={14} /></Link>
        </Card>
      </div>
    </div>
  );
}
