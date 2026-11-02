// How a payment went, for the Connections table: Cash or Bank, and through which
// account (the cash or bank side of the Payment Entry: paid_from when paying out,
// paid_to when receiving).

import { BankOutlined, WalletOutlined } from "@ant-design/icons";
import type { BaseRecord } from "@refinedev/core";
import { Tag, Tooltip, Typography } from "antd";

export interface PaymentVia {
	/** "Cash", "Bank", or the mode of payment when the account is neither. */
	type: string;
	account: string;
	mode?: string;
}

/** The Payment Entry fields paymentVia needs. */
export const PAYMENT_VIA_FIELDS = [
	"paid_from",
	"paid_to",
	"paid_from_account_type",
	"paid_to_account_type",
];

/** "1202 - Riyadh - O" → "Riyadh": the account without its number and company. */
const accountLabel = (account: string) =>
	account.replace(/^\d+\s*-\s*/, "").replace(/\s+-\s+[^-]+$/, "");

export function paymentVia(d: BaseRecord): PaymentVia | undefined {
	const receive = d.payment_type === "Receive";
	const account = String((receive ? d.paid_to : d.paid_from) ?? "");
	if (!account) return undefined;
	const type = String((receive ? d.paid_to_account_type : d.paid_from_account_type) ?? "");
	return {
		type: type === "Cash" || type === "Bank" ? type : d.mode_of_payment || type,
		account,
		mode: d.mode_of_payment,
	};
}

export default function PaidVia({ via }: { via?: PaymentVia }) {
	if (!via) return null;
	const bank = via.type === "Bank";
	return (
		<Tooltip title={[via.mode, via.account].filter(Boolean).join(" · ")}>
			<span style={{ whiteSpace: "nowrap" }}>
				<Tag
					color={bank ? "blue" : via.type === "Cash" ? "green" : undefined}
					icon={bank ? <BankOutlined /> : <WalletOutlined />}
				>
					{via.type}
				</Tag>
				<Typography.Text>{accountLabel(via.account)}</Typography.Text>
			</span>
		</Tooltip>
	);
}
