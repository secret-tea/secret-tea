export interface scanSummaryResultValue {
	secret: string;
	ruleID: string;
	file: string;
	line: number;
}

export interface scanHistoryResultValue {
	secret: string;
	ruleID: string;
	file: string;
	line: number;
	commit: string;
	author: string;
	email: string;
	date: string;
	link: string | null;
}