function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>
}

const LINKS: { title: string; href: string; description: string; icon: string }[] = [
  {
    title: 'Налоговые органы РБ',
    href: 'https://www.nalog.gov.by/',
    description: 'МНС: новости, календарь, электронные сервисы.',
    icon: 'account_balance',
  },
  {
    title: 'Портал ФСЗН',
    href: 'https://portal.ssf.gov.by/',
    description: 'Страховые взносы, отчётность, сервисы для работодателей.',
    icon: 'badge',
  },
  {
    title: 'Национальный банк РБ',
    href: 'https://www.nbrb.by/',
    description: 'Курсы валют, нормативка, официальная информация.',
    icon: 'currency_exchange',
  },
  {
    title: 'Единый портал электронных услуг',
    href: 'https://portal.gov.by/',
    description: 'Госуслуги и сведения для ИП и организаций.',
    icon: 'hub',
  },
  {
    title: 'Белстат',
    href: 'https://www.belstat.gov.by/',
    description: 'Статистическая отчётность и методология.',
    icon: 'analytics',
  },
  {
    title: 'Правовая информация',
    href: 'https://pravo.by/',
    description: 'Официальный интернет-портал правовой информации.',
    icon: 'gavel',
  },
]

export default function Websites() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
      <div className="fc-hero">
        <div className="fc-hero-strip" aria-hidden />
        <h1 className="page-heading">Сайты для работы</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Быстрые ссылки на официальные ресурсы (открываются в новой вкладке).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((x) => (
          <a
            key={x.href}
            href={x.href}
            target="_blank"
            rel="noopener noreferrer"
            className="card-elevated group flex gap-4 rounded-[1.25rem] border border-outline/70 p-4 shadow-card ring-1 ring-primary/[0.04] transition-colors hover:border-primary/35 hover:bg-primary/[0.04] sm:p-5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon name={x.icon} className="text-2xl" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-headline text-base font-bold text-on-surface group-hover:text-primary">{x.title}</h2>
              <p className="mt-1 text-xs text-on-surface-variant">{x.description}</p>
              <p className="mt-2 truncate font-mono text-[11px] text-primary/90">{x.href}</p>
            </div>
            <Icon name="open_in_new" className="shrink-0 text-on-surface-variant opacity-60 group-hover:opacity-100" />
          </a>
        ))}
      </div>
    </div>
  )
}
