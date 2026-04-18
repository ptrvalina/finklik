import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { counterpartiesApi } from '../api/client'
import AppModal from '../components/ui/AppModal'

function Icon({ name, filled, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {name}
    </span>
  )
}

export default function CounterpartiesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const emptyForm = { name: '', unp: '', address: '', phone: '', email: '', bank_account: '', bank_name: '', notes: '' }
  const [form, setForm] = useState({ ...emptyForm })

  const { data, isLoading } = useQuery({
    queryKey: ['counterparties', search],
    queryFn: () => counterpartiesApi.list({ q: search || undefined }).then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: () => (editing ? counterpartiesApi.update(editing.id, form) : counterpartiesApi.create(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counterparties'] })
      closeModal()
      setMessage({ type: 'success', text: editing ? 'Обновлён' : 'Добавлен' })
    },
    onError: (e: any) => setMessage({ type: 'error', text: e.response?.data?.detail || 'Ошибка' }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => counterpartiesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counterparties'] })
      setMessage({ type: 'success', text: 'Удалён' })
    },
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }
  function openEdit(cp: any) {
    setEditing(cp)
    setForm({
      name: cp.name,
      unp: cp.unp,
      address: cp.address || '',
      phone: cp.phone || '',
      email: cp.email || '',
      bank_account: cp.bank_account || '',
      bank_name: cp.bank_name || '',
      notes: cp.notes || '',
    })
    setShowModal(true)
  }
  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm({ ...emptyForm })
  }

  const items = (data as any[]) ?? []

  return (
    <div className="max-w-7xl space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">Контрагенты</h1>
          <p className="mt-1 text-sm text-zinc-500">Справочник организаций и ИП</p>
        </div>
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={openCreate}>
          <Icon name="add" className="text-lg" /> Добавить
        </button>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${
            message.type === 'success'
              ? 'border-secondary/20 bg-secondary/10 text-secondary'
              : 'border-error/20 bg-error/10 text-error'
          }`}
        >
          <Icon name={message.type === 'success' ? 'check_circle' : 'error'} filled className="text-lg" /> {message.text}
        </div>
      )}

      <div className="rounded-2xl bg-surface-container-low p-4 border border-zinc-200/80 shadow-soft sm:p-5">
        <label className="label">Поиск по названию или УНП</label>
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-zinc-500" />
          <input
            className="input min-h-11 rounded-xl pl-10"
            placeholder="Введите название или УНП..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface-container-low border border-zinc-200/80 shadow-soft">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Загружаем...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center sm:p-16">
            <Icon name="handshake" className="text-5xl text-on-surface-variant/20" />
            <p className="mt-4 text-sm text-zinc-500">{search ? 'Ничего не найдено' : 'Контрагентов пока нет'}</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-white/[0.05] md:hidden">
              {items.map((cp: any) => (
                <li key={cp.id} className="p-4">
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-100">
                      <Icon name="corporate_fare" className="text-xl text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-headline text-sm font-bold text-on-surface">{cp.name}</p>
                      <p className="font-mono text-xs text-zinc-500">УНП {cp.unp}</p>
                      {cp.address && <p className="mt-1 text-xs text-zinc-500">{cp.address}</p>}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                        {cp.phone && <span>{cp.phone}</span>}
                        {cp.bank_name && <span className="truncate">{cp.bank_name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="tap-highlight-none flex flex-1 items-center justify-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50 py-2.5 text-xs font-bold text-zinc-700"
                      onClick={() => openEdit(cp)}
                    >
                      <Icon name="edit" className="text-lg" /> Изменить
                    </button>
                    <button
                      type="button"
                      className="tap-highlight-none flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-300"
                      onClick={() => {
                        if (confirm('Удалить контрагента?')) removeMutation.mutate(cp.id)
                      }}
                      aria-label="Удалить"
                    >
                      <Icon name="delete" className="text-lg" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="bg-surface-container-high/50 text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
                    <th className="px-4 py-3 sm:px-6 sm:py-4">Название</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4">УНП</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4">Телефон</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4">Банк</th>
                    <th className="px-4 py-3 text-right sm:px-6 sm:py-4">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {items.map((cp: any) => (
                    <tr key={cp.id} className="group transition-colors hover:bg-surface-container-high">
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-highest">
                            <Icon name="corporate_fare" className="text-lg text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{cp.name}</p>
                            {cp.address && <p className="text-[10px] text-on-surface-variant">{cp.address}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-on-surface-variant sm:px-6 sm:py-4">{cp.unp}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant sm:px-6 sm:py-4">{cp.phone || '—'}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant sm:px-6 sm:py-4">{cp.bank_name || '—'}</td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <button type="button" className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => openEdit(cp)}>
                            <Icon name="edit" className="text-sm" />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost !px-2 !py-1 !text-xs text-error hover:text-error"
                            onClick={() => {
                              if (confirm('Удалить?')) removeMutation.mutate(cp.id)
                            }}
                          >
                            <Icon name="delete" className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <AppModal
          title={editing ? 'Редактировать контрагента' : 'Новый контрагент'}
          onClose={closeModal}
          wide
          footer={
            <div className="flex gap-3">
              <button type="button" className="btn-secondary min-h-12 flex-1" onClick={closeModal}>
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary min-h-12 flex-1"
                disabled={!form.name || form.unp.length !== 9 || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="label">Название *</label>
              <input
                className="input min-h-11 rounded-xl"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">УНП (9 цифр) *</label>
              <input
                className="input min-h-11 rounded-xl font-mono"
                maxLength={9}
                value={form.unp}
                onChange={(e) => setForm({ ...form, unp: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="label">Адрес</label>
              <input
                className="input min-h-11 rounded-xl"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Телефон</label>
                <input
                  className="input min-h-11 rounded-xl"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input min-h-11 rounded-xl"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Счёт</label>
                <input
                  className="input min-h-11 rounded-xl font-mono"
                  value={form.bank_account}
                  onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Банк</label>
                <input
                  className="input min-h-11 rounded-xl"
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Заметки</label>
              <textarea
                className="input min-h-[80px] rounded-xl"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}
