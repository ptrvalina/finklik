# Pilot — документы и команды

| Документ | Для кого | Назначение |
|----------|----------|------------|
| [PILOT_SCOPE.md](./PILOT_SCOPE.md) | **Клиент** | 1 стр.: что работает, что mock, честные ожидания |
| [PILOT_READINESS_SCORECARD.md](./PILOT_READINESS_SCORECARD.md) | **Команда** | Справка по блокам scorecard |
| [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) | **Внедрение** | Ручной чеклист на каждого клиента |
| [PILOT_READY.md](./PILOT_READY.md) | **Команда** | Статус 100% pilot ready |
| [PRODUCTION_GATE.md](./PRODUCTION_GATE.md) | **DevOps** | 🟢 prod scorecard + Playwright |

## Команды

```bash
make pilot-check              # scorecard → artifacts/
make pilot-prod-gate          # Docker PG + PILOT_TARGET=production
make pilot-e2e                # Playwright owner + accountant smoke
make pilot-prod-gate-e2e      # prod gate + E2E

PILOT_API_URL=https://... PILOT_TARGET=production PILOT_LIMITATIONS_ACK=1 make pilot-check
PILOT_RUN_E2E=1 make pilot-check   # scorecard + Playwright
PILOT_SKIP_BUILD=1 make pilot-check
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
