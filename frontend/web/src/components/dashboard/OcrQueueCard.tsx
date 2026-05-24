import { useNavigate } from 'react-router-dom'
import { ExecutionTaskCard } from '../execution/ExecutionTaskCard'

type Props = {
  count: number
}

/** Очередь OCR на главной — как задача, не как техническая метрика. */
export default function OcrQueueCard({ count }: Props) {
  const navigate = useNavigate()
  if (count <= 0) return null

  const label = count === 1 ? 'документ ждёт проверки' : count < 5 ? 'документа ждут проверки' : 'документов ждут проверки'

  return (
    <ExecutionTaskCard
      item={{
        id: 'ocr-queue-dashboard',
        type: 'document',
        priority: count > 3 ? 'high' : 'medium',
        title: `${count} ${label}`,
        context: 'Подтвердите сумму, дату и контрагента — проводка попадёт в журнал.',
        action_path: '/scan',
      }}
      compact
      prominent
      onOpen={(path) => {
        if (path) navigate(path)
      }}
    />
  )
}
