# Copyright (c) 2026, Kenz and contributors
# JMS API package. The dashboard functions are re-exported so the old paths
# (jms.api.job_cards, ... used by hooks.py and the Vue dashboard) keep working.

from jms.api.dashboard import (  # noqa: F401
	has_app_permission,
	job_cards,
	job_status_counts,
	job_tasks,
	update_task_status,
)
