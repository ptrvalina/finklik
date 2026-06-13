import { Link } from 'react-router-dom'
import { BentoGrid, GlassCard, HeroGradient, PageHeader, StitchIcon } from '../../components/stitch'

const cards = [
  { to: 'documents', title: 'Документы', desc: 'Приказы о приёме, увольнении и отпусках', icon: 'description', span: 'col-span-12 sm:col-span-6 lg:col-span-4' },
  { to: 'labor-book', title: 'Книга учёта движения трудовых книжек', desc: 'Записи о приёме, переводе и увольнении', icon: 'menu_book', span: 'col-span-12 sm:col-span-6 lg:col-span-4' },
  { to: 'timesheet', title: 'Табель', desc: 'Учёт рабочего времени, связь с приказами об отпуске', icon: 'calendar_month', span: 'col-span-12 sm:col-span-6 lg:col-span-4' },
  { to: 'hire', title: 'Приём сотрудников', desc: 'Анкета, приказ, ПУ-2, карточка', icon: 'person_add', span: 'col-span-12 lg:col-span-8', featured: true },
  { to: 'dismiss', title: 'Увольнение', desc: 'Приказ и основание по ТК РБ', icon: 'person_remove', span: 'col-span-12 sm:col-span-6 lg:col-span-4' },
  { to: 'staffing', title: 'Штатное расписание', desc: 'Должности, оклады, подразделения', icon: 'account_tree', span: 'col-span-12 sm:col-span-6 lg:col-span-4' },
] as const

const externalCards = [
  { to: '/planner', title: 'Задачи команды', desc: 'Поручения бухгалтеру и менеджерам', icon: 'task_alt', span: 'col-span-12 lg:col-span-4' },
] as const

export default function EmployeesHub() {
  return (
    <div className="fc-page-shell fc-page-shell-asymmetric space-y-section-sm pb-20 lg:pb-8">
      <PageHeader
        title="Команда"
        subtitle="Кадровые процессы: документы, трудовые книжки, табель и штатное расписание."
        actions={
          <Link to="/employees/list" className="btn-primary flex w-full min-h-touch-min items-center justify-center gap-2 text-sm sm:w-auto">
            <StitchIcon name="groups" className="text-lg" />
            Сотрудники
          </Link>
        }
      />

      <HeroGradient className="mb-gutter">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="font-label text-label-caps uppercase opacity-70">Кадровый центр</p>
            <h2 className="mt-2 font-headline text-headline-md">Управление персоналом</h2>
            <p className="mt-2 text-sm opacity-80">
              Документы, приём, увольнение и отчётность ФСЗН — всё в одном месте.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/employees/hire"
              className="flex min-h-touch-min items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur-md transition hover:bg-white/20"
            >
              <StitchIcon name="person_add" className="text-lg" />
              Принять сотрудника
            </Link>
            <Link
              to="/employees/list"
              className="flex min-h-touch-min items-center gap-2 rounded-full bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary shadow-lg transition hover:brightness-110"
            >
              <StitchIcon name="groups" className="text-lg" />
              Список штата
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-tertiary-fixed opacity-10 blur-[80px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-full w-1/2 bg-gradient-to-l from-tertiary/30 to-transparent" />
      </HeroGradient>

      <BentoGrid>
        {[...cards, ...externalCards].map((c) => (
          <Link key={c.to} to={c.to} className={c.span}>
            <GlassCard
              className={`group flex h-full flex-col gap-3 p-5 sm:p-6 ${
                'featured' in c && c.featured ? 'border-primary/20 bg-primary/[0.03] lg:min-h-[180px]' : ''
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  'featured' in c && c.featured
                    ? 'bg-primary text-on-primary'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                <StitchIcon name={c.icon} filled={'featured' in c && !!c.featured} className="text-2xl" />
              </div>
              <div>
                <h2 className="font-headline text-headline-sm text-on-surface transition group-hover:text-primary">
                  {c.title}
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">{c.desc}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                Открыть
                <StitchIcon name="arrow_forward" className="text-sm" />
              </span>
            </GlassCard>
          </Link>
        ))}
      </BentoGrid>
    </div>
  )
}
