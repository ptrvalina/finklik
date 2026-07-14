# Pilot — документы и команды

| Документ | Для кого | Назначение |
|----------|----------|------------|
| [PILOT_SCOPE.md](./PILOT_SCOPE.md) | **Клиент** | 1 стр.: что работает, что mock, честные ожидания |
| [PILOT_READINESS_SCORECARD.md](./PILOT_READINESS_SCORECARD.md) | **Команда** | Справка по блокам scorecard |
| [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) | **Внедрение** | Ручной чеклист на каждого клиента |
| [PILOT_READY.md](./PILOT_READY.md) | **Команда** | Статус 100% pilot ready |

## Команды

```bash
# Автоматический scorecard → artifacts/pilot-readiness-scorecard.md
make pilot-check

# Production API (строже: PostgreSQL, secrets)
PILOT_API_URL=https://your-api.example.com PILOT_TARGET=production PILOT_LIMITATIONS_ACK=1 make pilot-check

# Быстрее без frontend build
PILOT_SKIP_BUILD=1 make pilot-check

# Pre-demo (короче, без scorecard)
make demo-smoke
```

## Процесс подключения клиента

1. `make pilot-check` → 🟢 или 🟡  
2. Отправить клиенту **PILOT_SCOPE.md**  
3. Пройти **PILOT_READINESS_CHECKLIST.md**  
4. Invite + onboarding + optional seed template  
5. Неделя 1: friction analytics + sync call  

## Связанные runbook

- [../dev/FIRST_CLIENT_RUNBOOK.md](../dev/FIRST_CLIENT_RUNBOOK.md)  
- [../dev/DEMO_TENANT_CHECKLIST.md](../dev/DEMO_TENANT_CHECKLIST.md)  
- [../dev/PRE_DEMO_SMOKE.md](../dev/PRE_DEMO_SMOKE.md)  
- [../dev/SPRINT_DEFERRED_EXTERNAL.md](../dev/SPRINT_DEFERRED_EXTERNAL.md)  
