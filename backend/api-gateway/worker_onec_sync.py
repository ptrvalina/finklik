import asyncio
import structlog

from app.core.config import settings
from app.services.onec_sync_service import process_onec_sync_jobs_forever


structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer() if not settings.DEBUG else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(0),
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)
log = structlog.get_logger()


async def main() -> None:
    log.info("onec_sync_worker_start", service="onec-sync-worker")
    await process_onec_sync_jobs_forever()


if __name__ == "__main__":
    asyncio.run(main())
