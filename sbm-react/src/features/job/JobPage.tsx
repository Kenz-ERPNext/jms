// One job: header with the next step, progress and money, then tabs. The tab is
// kept in the URL (?tab=) so a link can open the right one.

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Flex, Skeleton, Tabs } from "antd";
import { useNavigate, useSearchParams } from "react-router";

import { useRunAction } from "@/features/job-actions/JobActionsProvider";
import { jobsPath } from "@/lib/links";
import { ADMIN_ROLES, hasAnyRole } from "@/lib/roles";
import { tokens } from "@/theme/tokens";

import { useStatusAction } from "./jobActions";
import JobHeader from "./JobHeader";
import JobProgress from "./JobProgress";
import DocumentsTab from "./tabs/DocumentsTab";
import HistoryTab from "./tabs/HistoryTab";
import MoneyTab from "./tabs/MoneyTab";
import OverviewTab from "./tabs/OverviewTab";
import TasksTab from "./tabs/TasksTab";
import { useJob, useJobName } from "./useJob";

export default function JobPage() {
	const name = useJobName();
	const navigate = useNavigate();
	const [params, setParams] = useSearchParams();
	const { job, state, isLoading, error, refetch } = useJob(name);
	const setStatus = useStatusAction(() => void refetch());
	const runAction = useRunAction();
	const tab = params.get("tab") || "overview";
	const openTab = (key: string) => setParams({ tab: key }, { replace: true });

	const onAction = (key: string) => {
		if (key === "tasks") openTab("tasks");
		else if (key === "close" || key === "cancel") setStatus(name, key);
		else runAction(name, key);
	};

	const back = (
		<Button
			type="link"
			icon={<ArrowLeftOutlined />}
			onClick={() => navigate(jobsPath())}
			style={{ padding: 0 }}
		>
			Jobs
		</Button>
	);
	if (error)
		return (
			<>
				{back}
				<Alert
					type="error"
					showIcon
					message="Could not open this job"
					description={error.message}
				/>
			</>
		);
	if (isLoading || !job)
		return (
			<>
				{back}
				<Skeleton active paragraph={{ rows: 12 }} />
			</>
		);

	const items = [
		{ key: "overview", label: "Overview", children: <OverviewTab job={job} /> },
		{
			key: "tasks",
			label: `Tasks (${job.tasks.length})`,
			children: <TasksTab tasks={job.tasks} />,
		},
		{
			key: "money",
			label: "Money",
			children: <MoneyTab name={name} metrics={state?.financials.metrics ?? []} />,
		},
		{
			key: "documents",
			label: `Documents (${job.documents.length})`,
			children: <DocumentsTab documents={job.documents} />,
		},
		...(hasAnyRole(ADMIN_ROLES)
			? [{ key: "history", label: "History", children: <HistoryTab name={name} /> }]
			: []),
	];

	return (
		<Flex vertical gap={tokens.space.lg}>
			<div>
				{back}
				<JobHeader job={job} state={state} onAction={onAction} />
			</div>
			<JobProgress job={job} state={state} />
			<Card styles={{ body: { paddingTop: 0 } }}>
				<Tabs activeKey={tab} onChange={openTab} items={items} destroyOnHidden />
			</Card>
		</Flex>
	);
}
