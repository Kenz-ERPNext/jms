// A document read-only: its fields with a value, by the form's sections, and its
// child tables. Links open the linked document here; desk users can open it in the
// desk. Submit / Cancel / Amend are in DocActions.

import { ArrowLeftOutlined, ExportOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
	Alert,
	Button,
	Descriptions,
	Drawer,
	Flex,
	Grid,
	Skeleton,
	Table,
	Typography,
} from "antd";

import StatusPill from "@/components/StatusPill";
import { canUseDesk } from "@/lib/boot";
import { deskPath } from "@/lib/links";
import { tokens } from "@/theme/tokens";

import DocActions from "./DocActions";
import {
	display,
	docStatus,
	linkOf,
	loadDoc,
	NUMBER,
	toSections,
	type Doc,
	type DocField,
} from "./docView";

interface Props {
	current?: { doctype: string; name: string };
	canGoBack: boolean;
	onBack: () => void;
	onOpen: (doctype: string, name: string) => void;
	onClose: () => void;
}

export default function DocViewDrawer({ current, canGoBack, onBack, onOpen, onClose }: Props) {
	const { md } = Grid.useBreakpoint();
	const q = useQuery({
		queryKey: ["doc-view", current?.doctype, current?.name],
		queryFn: () => loadDoc(current!.doctype, current!.name),
		enabled: !!current,
	});

	const value = (field: DocField, doc: Doc) => {
		const text = display(doc[field.fieldname], field, doc);
		const link = linkOf(field, doc);
		return link ? (
			<a className="sbm-cell-link" onClick={() => onOpen(link.doctype, link.name)}>
				{text}
			</a>
		) : (
			text
		);
	};

	const doc = q.data?.doc;
	const meta = current && q.data?.metas[current.doctype];
	const sections = doc && meta ? toSections(meta, doc, q.data!.metas) : [];

	return (
		<Drawer
			open={!!current}
			onClose={onClose}
			width={md ? 820 : "100%"}
			destroyOnHidden
			title={
				<Flex align="center" gap={tokens.space.sm}>
					{canGoBack && (
						<Button
							type="text"
							size="small"
							icon={<ArrowLeftOutlined />}
							onClick={onBack}
							aria-label="Back"
						/>
					)}
					<span>
						{current?.doctype}{" "}
						<Typography.Text type="secondary">{current?.name}</Typography.Text>
					</span>
					{doc && <StatusPill value={docStatus(doc)} />}
				</Flex>
			}
			extra={
				<Flex gap={tokens.space.xs}>
					{current && doc && meta && (
						<DocActions
							doctype={current.doctype}
							doc={doc}
							meta={meta}
							onLeave={onClose}
						/>
					)}
					{current && canUseDesk() && (
						<Button
							size="small"
							icon={<ExportOutlined />}
							href={deskPath(current.doctype, current.name)}
							target="_blank"
						>
							Open in desk
						</Button>
					)}
				</Flex>
			}
		>
			{q.isLoading && <Skeleton active />}
			{q.error && <Alert type="error" showIcon message={(q.error as Error).message} />}
			{doc &&
				sections.map((s, i) => (
					<div key={i} style={{ marginBottom: tokens.space.lg }}>
						{s.fields.length > 0 && (
							<Descriptions
								title={s.label || undefined}
								size="small"
								bordered
								column={md ? 2 : 1}
								items={s.fields.map(({ field }) => ({
									key: field.fieldname,
									label: field.label || field.fieldname,
									children: value(field, doc),
								}))}
							/>
						)}
						{s.tables.map((t) => (
							<div key={t.field.fieldname} style={{ marginTop: tokens.space.md }}>
								<Typography.Text strong>
									{t.field.label} ({t.rows.length})
								</Typography.Text>
								<Table<Doc>
									style={{ marginTop: tokens.space.xs }}
									size="small"
									rowKey="name"
									pagination={false}
									scroll={{ x: "max-content" }}
									dataSource={t.rows}
									columns={t.columns.map((c) => ({
										title: c.label,
										dataIndex: c.fieldname,
										align: NUMBER.includes(c.fieldtype) ? "right" : "left",
										render: (_: unknown, row: Doc) =>
											value(c, { currency: doc.currency, ...row }),
									}))}
								/>
							</div>
						))}
					</div>
				))}
		</Drawer>
	);
}
