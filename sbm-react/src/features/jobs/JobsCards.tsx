// Jobs as cards, like the desk Job Portal (/app/job-list): one card a job, coloured by
// where it is (JobCard), in a grid with the same pages as the table.

import { Col, Empty, Flex, Pagination, Row, Spin } from "antd";

import { tokens } from "@/theme/tokens";

import JobCard from "./JobCard";
import type { useJobsList } from "./useJobsList";

const { space } = tokens;

type ListState = ReturnType<typeof useJobsList>;

export default function JobsCards({ list }: { list: ListState }) {
	const jobs = list.data?.jobs ?? [];

	return (
		<Spin spinning={list.isLoading}>
			{jobs.length === 0 ? (
				<Empty
					style={{ padding: space.xxl }}
					description={
						list.isLoading
							? " "
							: "No jobs match. Try another tab or clear the filters."
					}
				/>
			) : (
				<Row gutter={[space.lg, space.lg]}>
					{jobs.map((job) => (
						<Col key={job.name} xs={24} md={12} xl={8} xxl={6}>
							<JobCard job={job} />
						</Col>
					))}
				</Row>
			)}
			<Flex justify="end" style={{ marginTop: space.lg }}>
				<Pagination
					current={list.page}
					pageSize={list.pageSize}
					total={list.data?.total ?? 0}
					showSizeChanger
					pageSizeOptions={[12, 24, 48]}
					showTotal={(total) => `${total.toLocaleString()} jobs`}
					onChange={(page, size) => list.update({ page, size })}
				/>
			</Flex>
		</Spin>
	);
}
