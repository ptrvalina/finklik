import { useState } from 'react'
import { api } from '../../api/client'

export default function EmployeesHrPlanner() {
  const [pu2Due, setPu2Due] = useState('')
  const [pu2Kind, setPu2Kind] = useState<'hire' | 'fire'>('hire')
  const [docTitle, setDocTitle] = useState('')
  const [docDue, setDocDue] = useState('')
  const [busy, setBusy] = useState(false)

  async function addPu2Reminder() {
    if (!pu2Due) return
    setBusy(true)
    try {
      const title =
        pu2Kind === 'hire'
          ? `Крайний срок подачи ПУ-2 (приём)`
          : `Крайний срок подачи ПУ-2 (увольнение)`
      await api.post('/calendar/events', {
        title,
        description: `Тип: ${pu2Kind}. Не забудьте проверить регламент ФСЗН.`,
        event_date: pu2Due,
        event_type: 'deadline',
        color: '#C026D3',
      })
      alert('Напоминание добавлено в календарь')
    } catch {
      alert('Не удалось создать событие')
    } finally {
      setBusy(false)
    }
  }

  async function addDocReminder() {
    if (!docDue || !docTitle.trim()) return
    setBusy(true)
    try {
      await api.post('/calendar/events', {
        title: docTitle.trim(),
        description: 'Напоминание по сроку документа (вычет, больничный и т.п.).',
        event_date: docDue,
        event_type: 'deadline',
        color: '#2563EB',
      })
      alert('Событие создано')
    } catch {
      alert('Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card-elevated space-y-3 p-6">
        <h2 className="text-lg font-semibold text-on-surface">ПУ-2 ФСЗН</h2>
        <label className="text-sm text-on-surface-variant block">
          Тип
          <select className="input mt-1" value={pu2Kind} onChange={(e) => setPu2Kind(e.target.value as 'hire' | 'fire')}>
            <option value="hire">Приём</option>
            <option value="fire">Увольнение</option>
          </select>
        </label>
        <label className="text-sm text-on-surface-variant block">
          Крайняя дата подачи
          <input className="input mt-1" type="date" value={pu2Due} onChange={(e) => setPu2Due(e.target.value)} />
        </label>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void addPu2Reminder()}>
          Создать напоминание
        </button>
      </div>

      <div className="card-elevated space-y-3 p-6">
        <h2 className="text-lg font-semibold text-on-surface">Сроки документов</h2>
        <input className="input" placeholder="Название (напр. Справка для вычета)" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
        <input className="input" type="date" value={docDue} onChange={(e) => setDocDue(e.target.value)} />
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void addDocReminder()}>
          Добавить в календарь
        </button>
        <p className="text-xs text-on-surface-variant">Полный планер доступен в разделе «Планер» в главном меню.</p>
      </div>
    </div>
  )
}
