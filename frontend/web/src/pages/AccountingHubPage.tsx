import { Link } from 'react-router-dom'
import OperationalPage, { FocusStrip } from '../components/shell/OperationalPage'

type HubTile = { to: string; icon: string; title: string; desc: string; primary?: boolean }

const TILES: HubTile[] = [
  {
    to: '/accounting',
    icon: 'menu_book',
    title: 'Журнал операций',
    desc: 'КУДиР-first: суммы, категории, проведение',
    primary: true,
  },
  { to: '/scan', icon: 'document_scanner', title: 'Сканер', desc: 'Чек → операция за минуту' },
  { to: '/legacy/documents', icon: 'folder_open', title: 'Документы и импорт', desc: 'CSV, первичка, счета' },
  { to: '/bank', icon: 'account_balance_wallet', title: 'Банк и сверка', desc: 'Выписка и сопоставление с журналом' },
  { to: '/accounting/chart', icon: 'account_tree', title: 'План счетов', desc: 'Счета и субсчета РБ' },
  { to: '/accounting/fixed-assets', icon: 'inventory_2', title: 'ОС и амортизация', desc: 'Реестр и начисление' },
  { to: '/counterparties', icon: 'handshake', title: 'Контрагенты', desc: 'Память по партнёрам' },
]

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

export default function AccountingHubPage() {
  return (
    <OperationalPage
      eyebrow="Учёт · Беларусь"
      title="Учёт"
      description="Не бухгалтерская программа — рабочее место: журнал, документы, банк и план счетов в одном потоке."
      primaryAction={
        <Link to="/accounting" className="btn-primary w-full sm:w-auto">
          <Icon name="edit_note" className="text-lg" /> Открыть журнал
        </Link>
      }
      secondaryActions={
        <Link to="/scan" className="btn-secondary w-full sm:w-auto">
          <Icon name="document_scanner" className="text-lg" /> Сканер
        </Link>
      }
      focusStrip={
        <FocusStrip
          headline="Начните со скана или журнала"
          supporting="OCR создаёт черновик операции — вы только подтверждаете сумму и категорию."
          ctaLabel="Сканер"
          ctaTo="/scan"
        />
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={`fc-accounting-tile group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${
              t.primary
                ? 'border-primary/35 bg-primary/[0.06] ring-1 ring-primary/20'
                : 'border-outline/40 bg-surface/90 hover:border-primary/30'
            }`}
          >
            <Icon
              name={t.icon}
              className={`text-2xl ${t.primary ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'}`}
            />
            <p className="mt-3 font-headline text-sm font-bold text-on-surface">{t.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{t.desc}</p>
          </Link>
        ))}
      </div>
    </OperationalPage>
  )
}
