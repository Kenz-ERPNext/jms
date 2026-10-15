// Plain names for the work & money stages the server sends, used everywhere a
// stage is shown (Jobs tabs, stage pills), so a stage never reads like a status.

export const STAGE_LABEL: Record<string, string> = {
	"Processing Work": "Work in progress",
	"Invoice Pending": "Ready to invoice",
	"Amount Pending": "Waiting for payment",
	"Exp Pending": "Supplier to pay",
	Completed: "Ready to close",
};

export const stageLabel = (stage?: string | null) => (stage && STAGE_LABEL[stage]) || stage || "";
