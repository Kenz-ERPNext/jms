import { describe, expect, it } from "vitest";

import { afterLoginPath, isAppPath } from "./redirect";

const ORIGIN = "https://service.example.com";
const go = (search: string) => afterLoginPath(search, ORIGIN);

describe("afterLoginPath", () => {
	it("goes to the app home by default", () => {
		expect(go("")).toBe("/sbm");
	});

	it("follows ERPNext's redirect-to (a site path)", () => {
		expect(go("?redirect-to=%2Fapp%2Fjob%2FJOB-1")).toBe("/app/job/JOB-1");
	});

	it("follows the SBM router's to", () => {
		expect(go("?to=%2Fsbm%2Fjobs%3Ftab%3DClosed")).toBe("/sbm/jobs?tab=Closed");
	});

	it("never leaves the site", () => {
		expect(go("?redirect-to=https://evil.example/x")).toBe("/sbm");
		expect(go("?redirect-to=//evil.example/x")).toBe("/sbm");
		expect(go("?redirect-to=%2F%5Cevil.example")).toBe("/sbm");
	});

	it("goes to the SBM home instead of the ERPNext desk home", () => {
		expect(go("?redirect-to=%2Fapp")).toBe("/sbm");
		expect(go("?redirect-to=/app/")).toBe("/sbm");
		expect(go("?redirect-to=/")).toBe("/sbm");
		expect(go("?redirect-to=%2Fapp%2Fjms-dashboard")).toBe("/sbm");
		expect(go("?redirect-to=/app/sbm/")).toBe("/sbm");
		expect(go("?redirect-to=%2Fapp%2Fjob%2FJOB-1")).toBe("/app/job/JOB-1");
	});

	it("never loops back to a login page", () => {
		expect(go("?redirect-to=/login")).toBe("/sbm");
		expect(go("?to=/login")).toBe("/sbm");
		expect(go("?to=/sbm/login")).toBe("/sbm");
	});
});

describe("isAppPath", () => {
	it("is true only for /sbm paths", () => {
		expect(isAppPath("/sbm")).toBe(true);
		expect(isAppPath("/sbm/jobs")).toBe(true);
		expect(isAppPath("/sbmx")).toBe(false);
		expect(isAppPath("/app/job")).toBe(false);
	});
});
