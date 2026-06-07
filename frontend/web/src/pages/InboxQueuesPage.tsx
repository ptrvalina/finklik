import { Link, useSearchParams } from 'react-router-dom'
import InboxPage from './InboxPage'
import ApprovalsPage from './ApprovalsPage'

/** Единая очередь решений: входящие + согласования. */
export default function InboxQueuesPage() {
  const [params, setSearchParams] = useSearchParams()
  const tab = params.get('tab') === 'approvals' ? 'approvals' : 'inbox'

  function setTab(next: 'inbox' | 'approvals') {
    if (next === 'inbox') setSearchParams({})
    else setSearchParams({ tab: 'approvals' })
  }

  return (
    <div className="fc-page-shell fc-page-shell-asymmetric pb-24 lg:pb-6">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-outline/25 pb-4">
        <h1 className="page-heading mr-auto">Очередь</h1>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setTab('inbox')}
            className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition sm:flex-none ${
              tab === 'inbox' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            Входящие
          </button>
          <button
            type="button"
            onClick={() => setTab('approvals')}
            className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition sm:flex-none ${
              tab === 'approvals' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            Согласования
          </button>
        </div>
        <Link to="/operations" className="btn-ghost hidden min-h-10 text-xs sm:inline-flex">
          Все задачи
        </Link>
      </div>
      {tab === 'approvals' ? <ApprovalsPage embedded /> : <InboxPage embedded />}
    </div>
  )
}
