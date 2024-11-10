import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { jest } from "@jest/globals";

import { WritableStreamBuffer } from "stream-buffers";
import { addPrereleaseToPackageRootConfig, copyDirectory, createNewTestingFiles } from "../helpers/file.js";
import { gitInit, gitAdd, gitCommit, gitCommitAll, gitInitOrigin, gitPush, gitTag, gitGetLog } from "../helpers/git";
import multiSemanticRelease from "../../lib/multiSemanticRelease.js";

const require = createRequire(import.meta.url);
const env = {};

// Clear mocks before tests.
beforeEach(() => {
	jest.clearAllMocks(); // Clear all mocks.
	// require.cache = {}; // Clear the require cache so modules are loaded fresh.
});

// Tests.
describe("multiSemanticRelease()", () => {
	test("Initial commit (changes in all packages)", async () => {
		// Create Git repo with copy of Yarn workspaces fixture.
		const cwd = gitInit();
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		const sha = gitCommitAll(cwd, "feat: Initial release");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result = await multiSemanticRelease(
			[
				`packages/a/package.json`,
				`packages/b/package.json`,
				`packages/c/package.json`,
				`packages/d/package.json`,
			],
			{},
			{ cwd, stdout, stderr, env }
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 4 packages...");
		expect(out).toMatch("Loaded package msr-test-a");
		expect(out).toMatch("Loaded package msr-test-b");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 4 packages! Starting release...");
		expect(out).toMatch("Created tag msr-test-a@1.0.0");
		expect(out).toMatch("Created tag msr-test-b@1.0.0");
		expect(out).toMatch("Created tag msr-test-c@1.0.0");
		expect(out).toMatch("Created tag msr-test-d@1.0.0");
		expect(out).toMatch("Released 4 of 4 packages, semantically!");

		// A.
		expect(result[0].name).toBe("msr-test-a");
		expect(result[0].result.lastRelease).toEqual({});
		expect(result[0].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-a@1.0.0",
			type: "minor",
			version: "1.0.0",
		});
		expect(result[0].result.nextRelease.notes).toMatch("# msr-test-a 1.0.0");
		expect(result[0].result.nextRelease.notes).toMatch("### Features\n\n* Initial release");

		// B.
		expect(result[2].name).toBe("msr-test-b");
		expect(result[2].result.lastRelease).toEqual({});
		expect(result[2].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-b@1.0.0",
			type: "minor",
			version: "1.0.0",
		});
		expect(result[2].result.nextRelease.notes).toMatch("# msr-test-b 1.0.0");
		expect(result[2].result.nextRelease.notes).toMatch("### Features\n\n* Initial release");
		expect(result[2].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-a:** upgraded to 1.0.0");

		// C.
		expect(result[3].name).toBe("msr-test-c");
		expect(result[3].result.lastRelease).toEqual({});
		expect(result[3].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-c@1.0.0",
			type: "minor",
			version: "1.0.0",
		});
		expect(result[3].result.nextRelease.notes).toMatch("# msr-test-c 1.0.0");
		expect(result[3].result.nextRelease.notes).toMatch("### Features\n\n* Initial release");
		expect(result[3].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-b:** upgraded to 1.0.0");

		// D.
		expect(result[1].name).toBe("msr-test-d");
		expect(result[1].result.lastRelease).toEqual({});
		expect(result[1].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-d@1.0.0",
			type: "minor",
			version: "1.0.0",
		});
		expect(result[1].result.nextRelease.notes).toMatch("# msr-test-d 1.0.0");
		expect(result[1].result.nextRelease.notes).toMatch("### Features\n\n* Initial release");
		expect(result[1].result.nextRelease.notes).not.toMatch("### Dependencies");

		// ONLY four times.
		expect(result).toHaveLength(4);

		// Check manifests.
		expect(require(`${cwd}/packages/a/package.json`)).toMatchObject({
			peerDependencies: {
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/b/package.json`)).toMatchObject({
			dependencies: {
				"msr-test-a": "1.0.0",
			},
			devDependencies: {
				"msr-test-d": "1.0.0",
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			devDependencies: {
				"msr-test-d": "1.0.0",
			},
		});
	});
	test("Initial commit (changes in all packages with prereleases)", async () => {
		// Create Git repo with copy of Yarn workspaces fixture.
		const cwd = gitInit("master", "release");
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		const sha = gitCommitAll(cwd, "feat: Initial release");
		gitInitOrigin(cwd, "release");
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result = await multiSemanticRelease(
			[
				`packages/a/package.json`,
				`packages/b/package.json`,
				`packages/c/package.json`,
				`packages/d/package.json`,
			],
			{
				branches: [{ name: "master", prerelease: "dev" }, { name: "release" }],
			},
			{ cwd, stdout, stderr, env }
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 4 packages...");
		expect(out).toMatch("Loaded package msr-test-a");
		expect(out).toMatch("Loaded package msr-test-b");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 4 packages! Starting release...");
		expect(out).toMatch("Created tag msr-test-a@1.0.0-dev.1");
		expect(out).toMatch("Created tag msr-test-b@1.0.0-dev.1");
		expect(out).toMatch("Created tag msr-test-c@1.0.0-dev.1");
		expect(out).toMatch("Created tag msr-test-d@1.0.0-dev.1");
		expect(out).toMatch("Released 4 of 4 packages, semantically!");

		// A.
		expect(result[0].name).toBe("msr-test-a");
		expect(result[0].result.lastRelease).toEqual({});
		expect(result[0].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-a@1.0.0-dev.1",
			type: "minor",
			version: "1.0.0-dev.1",
		});
		expect(result[0].result.nextRelease.notes).toMatch("# msr-test-a 1.0.0-dev.1");
		expect(result[0].result.nextRelease.notes).toMatch("### Features\n\n* Initial release");

		// B.
		expect(result[2].name).toBe("msr-test-b");
		expect(result[2].result.lastRelease).toEqual({});
		expect(result[2].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-b@1.0.0-dev.1",
			type: "minor",
			version: "1.0.0-dev.1",
		});
		expect(result[2].result.nextRelease.notes).toMatch("# msr-test-b 1.0.0-dev.1");
		expect(result[2].result.nextRelease.notes).toMatch("### Features\n\n* Initial release");
		expect(result[2].result.nextRelease.notes).toMatch(
			"### Dependencies\n\n* **msr-test-a:** upgraded to 1.0.0-dev.1\n* **msr-test-d:** upgraded to 1.0.0-dev.1"
		);

		// C.
		expect(result[3].name).toBe("msr-test-c");
		expect(result[3].result.lastRelease).toEqual({});
		expect(result[3].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-c@1.0.0-dev.1",
			type: "minor",
			version: "1.0.0-dev.1",
		});
		expect(result[3].result.nextRelease.notes).toMatch("# msr-test-c 1.0.0-dev.1");
		expect(result[3].result.nextRelease.notes).toMatch("### Features\n\n* Initial release");
		expect(result[3].result.nextRelease.notes).toMatch(
			"### Dependencies\n\n* **msr-test-b:** upgraded to 1.0.0-dev.1"
		);
		expect(result[3].result.nextRelease.notes).toMatch("**msr-test-d:** upgraded to 1.0.0-dev.1");

		// D.
		expect(result[1].name).toBe("msr-test-d");
		expect(result[1].result.lastRelease).toEqual({});
		expect(result[1].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-d@1.0.0-dev.1",
			type: "minor",
			version: "1.0.0-dev.1",
		});
		expect(result[1].result.nextRelease.notes).toMatch("# msr-test-d 1.0.0-dev.1");
		expect(result[1].result.nextRelease.notes).toMatch("### Features\n\n* Initial release");
		expect(result[1].result.nextRelease.notes).not.toMatch("### Dependencies");

		// ONLY four times.
		expect(result).toHaveLength(4);

		// Check manifests.
		expect(require(`${cwd}/packages/a/package.json`)).toMatchObject({
			peerDependencies: {
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/b/package.json`)).toMatchObject({
			dependencies: {
				"msr-test-a": "1.0.0-dev.1",
			},
			devDependencies: {
				"left-pad": "latest",
				"msr-test-d": "1.0.0-dev.1",
			},
		});
		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			devDependencies: {
				"msr-test-b": "1.0.0-dev.1",
				"msr-test-d": "1.0.0-dev.1",
			},
		});
	});
	test("Two separate releases (changes in only one package in second release with prereleases)", async () => {
		const packages = ["packages/c/", "packages/d/"];

		// Create Git repo with copy of Yarn workspaces fixture.
		const cwd = gitInit("master", "release");
		copyDirectory(`test/fixtures/yarnWorkspaces2Packages/`, cwd);
		const sha1 = gitCommitAll(cwd, "feat: Initial release");
		gitInitOrigin(cwd, "release");
		gitPush(cwd);

		let stdout = new WritableStreamBuffer();
		let stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		let result = await multiSemanticRelease(
			packages.map((folder) => `${folder}package.json`),
			{
				branches: [{ name: "master", prerelease: "dev" }, { name: "release" }],
			},
			{ cwd, stdout, stderr, env }
		);

		// Add new testing files for a new release.
		createNewTestingFiles(["packages/c/"], cwd);
		const sha = gitCommitAll(cwd, "feat: New release on package c only");
		gitPush(cwd);

		// Capture output.
		stdout = new WritableStreamBuffer();
		stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease() for a second release
		// Doesn't include plugins that actually publish.
		result = await multiSemanticRelease(
			packages.map((folder) => `${folder}package.json`),
			{
				branches: [{ name: "master", prerelease: "dev" }, { name: "release" }],
			},
			{ cwd, stdout, stderr, env }
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 2 packages...");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 2 packages! Starting release...");
		expect(out).toMatch("Created tag msr-test-c@1.0.0-dev.2");
		expect(out).toMatch("Released 1 of 2 packages, semantically!");

		// C.
		expect(result[1].name).toBe("msr-test-c");
		expect(result[1].result.lastRelease).toEqual({
			channels: ["master"],
			gitHead: sha1,
			gitTag: "msr-test-c@1.0.0-dev.1",
			name: "msr-test-c@1.0.0-dev.1",
			version: "1.0.0-dev.1",
		});
		expect(result[1].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-c@1.0.0-dev.2",
			type: "minor",
			version: "1.0.0-dev.2",
		});

		expect(result[1].result.nextRelease.notes).toMatch("# msr-test-c [1.0.0-dev.2]");
		expect(result[1].result.nextRelease.notes).toMatch("### Features\n\n* New release on package c only");
		expect(result[1].result.nextRelease.notes).not.toMatch("### Dependencies");

		// ONLY 2 time.
		expect(result).toHaveLength(2);

		// Check manifests.
		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			dependencies: {
				"msr-test-d": "1.0.0-dev.1",
			},
		});
	});

	test("Two separate releases (release to prerelease)", async () => {
		const packages = ["packages/c/", "packages/d/"];

		// Create Git repo with copy of Yarn workspaces fixture.
		const cwd = gitInit("master", "release");
		copyDirectory(`test/fixtures/yarnWorkspaces2Packages/`, cwd);
		const sha1 = gitCommitAll(cwd, "feat: Initial release");
		gitInitOrigin(cwd, "release");
		gitPush(cwd);

		let stdout = new WritableStreamBuffer();
		let stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		let result = await multiSemanticRelease(
			packages.map((folder) => `${folder}package.json`),
			{
				branches: [{ name: "master" }, { name: "release" }],
			},
			{ cwd, stdout, stderr, env }
		);

		// Add new testing files for a new release.
		createNewTestingFiles(packages, cwd);
		const sha = gitCommitAll(cwd, "feat: New prerelease\n\nBREAKING CHANGE: bump to bigger value");
		gitPush(cwd);

		// Capture output.
		stdout = new WritableStreamBuffer();
		stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease() for a second release
		// Doesn't include plugins that actually publish.
		// Change the master branch from release to prerelease to test bumping.
		result = await multiSemanticRelease(
			packages.map((folder) => `${folder}package.json`),
			{
				branches: [{ name: "master", prerelease: "beta", channel: "beta" }, { name: "release" }],
			},
			{ cwd, stdout, stderr, env }
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 2 packages...");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 2 packages! Starting release...");
		expect(out).toMatch("Created tag msr-test-c@2.0.0-beta.1");
		expect(out).toMatch("Created tag msr-test-d@2.0.0-beta.1");
		expect(out).toMatch("Released 2 of 2 packages, semantically!");

		// C.
		expect(result[1].name).toBe("msr-test-c");
		expect(result[1].result.lastRelease).toEqual({
			channels: [null],
			gitHead: sha1,
			gitTag: "msr-test-c@1.0.0",
			name: "msr-test-c@1.0.0",
			version: "1.0.0",
		});
		expect(result[1].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-c@2.0.0-beta.1",
			type: "major",
			version: "2.0.0-beta.1",
		});

		expect(result[1].result.nextRelease.notes).toMatch("# msr-test-c [2.0.0-beta.1]");
		expect(result[1].result.nextRelease.notes).toMatch("### Features\n\n* New prerelease");
		expect(result[1].result.nextRelease.notes).toMatch(
			"### Dependencies\n\n* **msr-test-d:** upgraded to 2.0.0-beta.1"
		);

		// D
		expect(result[0].result.nextRelease.notes).toMatch("# msr-test-d [2.0.0-beta.1]");
		expect(result[0].result.nextRelease.notes).toMatch("### Features\n\n* New prerelease");
		expect(result[0].result.nextRelease.notes).not.toMatch("### Dependencies");

		// ONLY 2 times.
		expect(result).toHaveLength(2);

		// Check manifests.
		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			dependencies: {
				"msr-test-d": "2.0.0-beta.1",
			},
		});

		// Add new testing files for a new release.
		createNewTestingFiles(packages, cwd);
		const shaPatch = gitCommitAll(cwd, "fix: add a patch");
		expect(shaPatch).toBeTruthy();
		gitPush(cwd);

		// Capture output.
		stdout = new WritableStreamBuffer();
		stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease() for a second release
		// Doesn't include plugins that actually publish.
		// Change the master branch from release to prerelease to test bumping.
		result = await multiSemanticRelease(
			packages.map((folder) => `${folder}package.json`),
			{
				branches: [{ name: "master", prerelease: "beta", channel: "beta" }, { name: "release" }],
			},
			{ cwd, stdout, stderr, env }
		);

		// Get stdout and stderr output.
		const errpatch = stderr.getContentsAsString("utf8");
		expect(errpatch).toBe(false);
		const outpatch = stdout.getContentsAsString("utf8");
		expect(outpatch).toMatch("Started multirelease! Loading 2 packages...");
		expect(outpatch).toMatch("Loaded package msr-test-c");
		expect(outpatch).toMatch("Loaded package msr-test-d");
		expect(outpatch).toMatch("Queued 2 packages! Starting release...");
		expect(outpatch).toMatch("Created tag msr-test-c@2.0.0-beta.2");
		expect(outpatch).toMatch("Created tag msr-test-d@2.0.0-beta.2");
		expect(outpatch).toMatch("Released 2 of 2 packages, semantically!");

		expect(result[0].name).toBe("msr-test-c");
		expect(result[0].result.nextRelease).toMatchObject({
			gitHead: shaPatch,
			gitTag: "msr-test-c@2.0.0-beta.2",
			type: "patch",
			version: "2.0.0-beta.2",
		});

		expect(result[1].result.nextRelease.notes).toMatch("# msr-test-d [2.0.0-beta.2]");

		// ONLY 1 time.
		expect(result).toHaveLength(2);

		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			dependencies: {
				"msr-test-d": "2.0.0-beta.2",
			},
		});


	}, 20000);
	test("Two separate releases (changes in all packages with prereleases)", async () => {
		const packages = ["packages/a/", "packages/b/", "packages/c/", "packages/d/"];

		// Create Git repo with copy of Yarn workspaces fixture.
		const cwd = gitInit("master", "release");
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		const sha1 = gitCommitAll(cwd, "feat: Initial release");
		gitInitOrigin(cwd, "release");
		gitPush(cwd);

		let stdout = new WritableStreamBuffer();
		let stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		let result = await multiSemanticRelease(
			packages.map((folder) => `${folder}package.json`),
			{
				branches: [{ name: "master", prerelease: "dev" }, { name: "release" }],
			},
			{ cwd, stdout, stderr, env }
		);

		// Add new testing files for a new release.
		createNewTestingFiles(packages, cwd);
		const sha = gitCommitAll(cwd, "feat: New releases");
		gitPush(cwd);

		// Capture output.
		stdout = new WritableStreamBuffer();
		stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease() for a second release
		// Doesn't include plugins that actually publish.
		result = await multiSemanticRelease(
			packages.map((folder) => `${folder}package.json`),
			{
				branches: [{ name: "master", prerelease: "dev" }, { name: "release" }],
			},
			{ cwd, stdout, stderr, env }
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 4 packages...");
		expect(out).toMatch("Loaded package msr-test-a");
		expect(out).toMatch("Loaded package msr-test-b");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 4 packages! Starting release...");
		expect(out).toMatch("Created tag msr-test-a@1.0.0-dev.2");
		expect(out).toMatch("Created tag msr-test-b@1.0.0-dev.2");
		expect(out).toMatch("Created tag msr-test-c@1.0.0-dev.2");
		expect(out).toMatch("Created tag msr-test-d@1.0.0-dev.2");
		expect(out).toMatch("Released 4 of 4 packages, semantically!");

		// A.
		expect(result[0].name).toBe("msr-test-a");
		expect(result[0].result.lastRelease).toEqual({
			channels: ["master"],
			gitHead: sha1,
			gitTag: "msr-test-a@1.0.0-dev.1",
			name: "msr-test-a@1.0.0-dev.1",
			version: "1.0.0-dev.1",
		});
		expect(result[0].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-a@1.0.0-dev.2",
			type: "minor",
			version: "1.0.0-dev.2",
		});
		expect(result[0].result.nextRelease.notes).toMatch("# msr-test-a [1.0.0-dev.2]");
		expect(result[0].result.nextRelease.notes).toMatch("### Features\n\n* New releases");

		// B.
		expect(result[2].name).toBe("msr-test-b");
		expect(result[2].result.lastRelease).toEqual({
			channels: ["master"],
			gitHead: sha1,
			gitTag: "msr-test-b@1.0.0-dev.1",
			name: "msr-test-b@1.0.0-dev.1",
			version: "1.0.0-dev.1",
		});
		expect(result[2].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-b@1.0.0-dev.2",
			type: "minor",
			version: "1.0.0-dev.2",
		});
		expect(result[2].result.nextRelease.notes).toMatch("# msr-test-b [1.0.0-dev.2]");
		expect(result[2].result.nextRelease.notes).toMatch("### Features\n\n* New releases");
		expect(result[2].result.nextRelease.notes).toMatch(
			"### Dependencies\n\n* **msr-test-a:** upgraded to 1.0.0-dev.2\n* **msr-test-d:** upgraded to 1.0.0-dev.2"
		);

		// C.
		expect(result[3].name).toBe("msr-test-c");
		expect(result[3].result.lastRelease).toEqual({
			channels: ["master"],
			gitHead: sha1,
			gitTag: "msr-test-c@1.0.0-dev.1",
			name: "msr-test-c@1.0.0-dev.1",
			version: "1.0.0-dev.1",
		});
		expect(result[3].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-c@1.0.0-dev.2",
			type: "minor",
			version: "1.0.0-dev.2",
		});
		expect(result[3].result.nextRelease.notes).toMatch("# msr-test-c [1.0.0-dev.2]");
		expect(result[3].result.nextRelease.notes).toMatch("### Features\n\n* New releases");
		expect(result[3].result.nextRelease.notes).toMatch(
			"### Dependencies\n\n* **msr-test-b:** upgraded to 1.0.0-dev.2\n* **msr-test-d:** upgraded to 1.0.0-dev.2"
		);

		// D.
		expect(result[1].name).toBe("msr-test-d");
		expect(result[1].result.lastRelease).toEqual({
			channels: ["master"],
			gitHead: sha1,
			gitTag: "msr-test-d@1.0.0-dev.1",
			name: "msr-test-d@1.0.0-dev.1",
			version: "1.0.0-dev.1",
		});
		expect(result[1].result.nextRelease).toMatchObject({
			gitHead: sha,
			gitTag: "msr-test-d@1.0.0-dev.2",
			type: "minor",
			version: "1.0.0-dev.2",
		});
		expect(result[1].result.nextRelease.notes).toMatch("# msr-test-d [1.0.0-dev.2]");
		expect(result[1].result.nextRelease.notes).toMatch("### Features\n\n* New releases");
		expect(result[1].result.nextRelease.notes).not.toMatch("### Dependencies");

		// ONLY four times.
		expect(result).toHaveLength(4);

		// Check manifests.
		expect(require(`${cwd}/packages/a/package.json`)).toMatchObject({
			peerDependencies: {
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/b/package.json`)).toMatchObject({
			dependencies: {
				"msr-test-a": "1.0.0-dev.2",
			},
			devDependencies: {
				"msr-test-d": "1.0.0-dev.2",
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			devDependencies: {
				"msr-test-b": "1.0.0-dev.2",
				"msr-test-d": "1.0.0-dev.2",
			},
		});
	}, 20000);
	test("No changes in any packages", async () => {
		// Create Git repo with copy of Yarn workspaces fixture.
		const cwd = gitInit();
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		const sha = gitCommitAll(cwd, "feat: Initial release");
		// Creating the four tags so there are no changes in any packages.
		gitTag(cwd, "msr-test-a@1.0.0");
		gitTag(cwd, "msr-test-b@1.0.0");
		gitTag(cwd, "msr-test-c@1.0.0");
		gitTag(cwd, "msr-test-d@1.0.0");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result = await multiSemanticRelease(
			[
				`packages/c/package.json`,
				`packages/a/package.json`,
				`packages/d/package.json`,
				`packages/b/package.json`,
			],
			{},
			{ cwd, stdout, stderr, env }
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 4 packages...");
		expect(out).toMatch("Loaded package msr-test-a");
		expect(out).toMatch("Loaded package msr-test-b");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 4 packages! Starting release...");
		expect(out).toMatch("There are no relevant changes, so no new version is released");
		expect(out).not.toMatch("Created tag");
		expect(out).toMatch("Released 0 of 4 packages, semantically!");

		// Results.
		expect(result[0].result).toBe(false);
		expect(result[1].result).toBe(false);
		expect(result[2].result).toBe(false);
		expect(result[3].result).toBe(false);
		expect(result).toHaveLength(4);
	});
	test("Changes in some packages", async () => {
		// Create Git repo.
		const cwd = gitInit();
		// Initial commit.
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		const sha1 = gitCommitAll(cwd, "feat: Initial release");
		gitTag(cwd, "msr-test-a@1.0.0");
		gitTag(cwd, "msr-test-b@1.0.0");
		gitTag(cwd, "msr-test-c@1.0.0");
		gitTag(cwd, "msr-test-d@1.0.0");
		// Second commit.
		writeFileSync(`${cwd}/packages/a/aaa.txt`, "AAA");
		const sha2 = gitCommitAll(cwd, "feat(aaa): Add missing text file");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result = await multiSemanticRelease(
			[
				`packages/d/package.json`,
				`packages/b/package.json`,
				`packages/a/package.json`,
				`packages/c/package.json`,
			],
			{},
			{ cwd, stdout, stderr, env },
			{ deps: {}, dryRun: false }
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 4 packages...");
		expect(out).toMatch("Loaded package msr-test-a");
		expect(out).toMatch("Loaded package msr-test-b");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 4 packages! Starting release...");
		expect(out).toMatch("Created tag msr-test-a@1.1.0");
		expect(out).toMatch("Created tag msr-test-b@1.0.1");
		// expect(out).toMatch("Created tag msr-test-c@1.0.1");
		expect(out).toMatch("There are no relevant changes, so no new version is released");
		expect(out).toMatch("Released 3 of 4 packages, semantically!");

		// A.
		expect(result[0].name).toBe("msr-test-a");
		expect(result[0].result.lastRelease).toMatchObject({
			gitHead: sha1,
			gitTag: "msr-test-a@1.0.0",
			version: "1.0.0",
		});
		expect(result[0].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: "msr-test-a@1.1.0",
			type: "minor",
			version: "1.1.0",
		});
		expect(result[0].result.nextRelease.notes).toMatch("# msr-test-a [1.1.0]");
		expect(result[0].result.nextRelease.notes).toMatch("### Features\n\n* **aaa:** Add missing text file");
		// expect(result[3].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-c:** upgraded to 1.0.1");

		// B.
		expect(result[2].name).toBe("msr-test-b");
		expect(result[2].result.lastRelease).toEqual({
			channels: [null],
			gitHead: sha1,
			gitTag: "msr-test-b@1.0.0",
			name: "msr-test-b@1.0.0",
			version: "1.0.0",
		});
		expect(result[2].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: "msr-test-b@1.0.1",
			type: "patch",
			version: "1.0.1",
		});
		expect(result[2].result.nextRelease.notes).toMatch("# msr-test-b [1.0.1]");
		expect(result[2].result.nextRelease.notes).not.toMatch("### Features");
		expect(result[2].result.nextRelease.notes).not.toMatch("### Bug Fixes");
		expect(result[2].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-a:** upgraded to 1.1.0");

		// C.
		expect(result[3].name).toBe("msr-test-c");
		expect(result[3].result.lastRelease).toEqual({
			channels: [null],
			gitHead: sha1,
			gitTag: "msr-test-c@1.0.0",
			name: "msr-test-c@1.0.0",
			version: "1.0.0",
		});
		expect(result[3].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: "msr-test-c@1.0.1",
			type: "patch",
			version: "1.0.1",
		});
		expect(result[3].result.nextRelease.notes).toMatch("# msr-test-c [1.0.1]");
		expect(result[3].result.nextRelease.notes).not.toMatch("### Features");
		expect(result[3].result.nextRelease.notes).not.toMatch("### Bug Fixes");
		expect(result[3].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-b:** upgraded to 1.0.1");

		// D.
		expect(result[1].name).toBe("msr-test-d");
		expect(result[1].result).toBe(false);

		// ONLY four times.
		expect(result[4]).toBe(undefined);

		// Check manifests.
		expect(require(`${cwd}/packages/a/package.json`)).toMatchObject({
			peerDependencies: {
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/b/package.json`)).toMatchObject({
			dependencies: {
				"msr-test-a": "1.1.0",
			},
			devDependencies: {
				"msr-test-d": "1.0.0",
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			devDependencies: {
				"msr-test-b": "1.0.1",
				"msr-test-d": "1.0.0",
			},
		});
	});

	// Bug state that we need to ensure doesn't happen again
	test("Changes in some packages with correct prerelease bumping from stable", async () => {
		const preReleaseBranch = "alpha";
		// Create Git repo.
		const cwd = gitInit(preReleaseBranch);
		// Initial commit.
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		addPrereleaseToPackageRootConfig(cwd, preReleaseBranch);

		const sha1 = gitCommitAll(cwd, "feat: Initial release");
		gitTag(cwd, "msr-test-a@1.0.0");
		gitTag(cwd, "msr-test-b@1.0.0");
		gitTag(cwd, "msr-test-c@1.0.0");
		gitTag(cwd, "msr-test-d@1.0.0");
		// Second commit.
		writeFileSync(`${cwd}/packages/a/aaa.txt`, "AAA");
		const sha2 = gitCommitAll(cwd, "feat(aaa): Add missing text file");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result = await multiSemanticRelease(
			[
				`packages/d/package.json`,
				`packages/b/package.json`,
				`packages/a/package.json`,
				`packages/c/package.json`,
			],
			{},
			{ cwd, stdout, stderr, env },
			{ deps: {}, dryRun: false }
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 4 packages...");
		expect(out).toMatch("Loaded package msr-test-a");
		expect(out).toMatch("Loaded package msr-test-b");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 4 packages! Starting release...");
		expect(out).toMatch(`Created tag msr-test-a@1.1.0-${preReleaseBranch}.1`);
		expect(out).toMatch(`Created tag msr-test-b@1.0.1-${preReleaseBranch}.1`);
		expect(out).toMatch(`Created tag msr-test-c@1.0.1-${preReleaseBranch}.1`);
		expect(out).toMatch("There are no relevant changes, so no new version is released");
		expect(out).toMatch("Released 3 of 4 packages, semantically!");

		// A.
		expect(result[0].name).toBe("msr-test-a");
		expect(result[0].result.lastRelease).toMatchObject({
			gitHead: sha1,
			gitTag: "msr-test-a@1.0.0",
			version: "1.0.0",
		});
		expect(result[0].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: `msr-test-a@1.1.0-${preReleaseBranch}.1`,
			type: "minor",
			version: `1.1.0-${preReleaseBranch}.1`,
		});
		expect(result[0].result.nextRelease.notes).toMatch(`# msr-test-a [1.1.0-${preReleaseBranch}.1]`);
		expect(result[0].result.nextRelease.notes).toMatch("### Features\n\n* **aaa:** Add missing text file");
		// expect(result[3].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-c:** upgraded to 1.0.1");

		// B.
		expect(result[2].name).toBe("msr-test-b");
		expect(result[2].result.lastRelease).toEqual({
			channels: [null],
			gitHead: sha1,
			gitTag: "msr-test-b@1.0.0",
			name: "msr-test-b@1.0.0",
			version: "1.0.0",
		});
		expect(result[2].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: `msr-test-b@1.0.1-${preReleaseBranch}.1`,
			type: "patch",
			version: `1.0.1-${preReleaseBranch}.1`,
		});
		expect(result[2].result.nextRelease.notes).toMatch(`# msr-test-b [1.0.1-${preReleaseBranch}.1]`);
		expect(result[2].result.nextRelease.notes).not.toMatch("### Features");
		expect(result[2].result.nextRelease.notes).not.toMatch("### Bug Fixes");
		expect(result[2].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-a:** upgraded to 1.1.0");

		// C.
		expect(result[3].name).toBe("msr-test-c");
		expect(result[3].result.lastRelease).toEqual({
			channels: [null],
			gitHead: sha1,
			gitTag: "msr-test-c@1.0.0",
			name: "msr-test-c@1.0.0",
			version: "1.0.0",
		});
		expect(result[3].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: `msr-test-c@1.0.1-${preReleaseBranch}.1`,
			type: "patch",
			version: `1.0.1-${preReleaseBranch}.1`,
		});
		expect(result[3].result.nextRelease.notes).toMatch(`# msr-test-c [1.0.1-${preReleaseBranch}.1]`);
		expect(result[3].result.nextRelease.notes).not.toMatch("### Features");
		expect(result[3].result.nextRelease.notes).not.toMatch("### Bug Fixes");
		expect(result[3].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-b:** upgraded to 1.0.1");

		// D.
		expect(result[1].name).toBe("msr-test-d");
		expect(result[1].result).toBe(false);

		// ONLY four times.
		expect(result[4]).toBe(undefined);

		// Check manifests.
		expect(require(`${cwd}/packages/a/package.json`)).toMatchObject({
			peerDependencies: {
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/b/package.json`)).toMatchObject({
			dependencies: {
				"msr-test-a": `1.1.0-${preReleaseBranch}.1`,
			},
			devDependencies: {
				"msr-test-d": "1.0.0",
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			devDependencies: {
				"msr-test-b": `1.0.1-${preReleaseBranch}.1`,
				"msr-test-d": "1.0.0",
			},
		});

		// Commit this like the git plugin would (with a skippable syntax)
		gitCommitAll(cwd, "docs(release): Release everything");

		// Release a second time to verify prerelease incrementation
		writeFileSync(`${cwd}/packages/a/bbb.txt`, "BBB");
		const sha3 = gitCommitAll(cwd, "feat(bbb): Add missing text file");
		gitPush(cwd);

		// Capture output.
		const stdout2 = new WritableStreamBuffer();
		const stderr2 = new WritableStreamBuffer();

		// NOTE: we call this again because we want to verify semantic-release
		//       channel tagging instead of simulating
		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result2 = await multiSemanticRelease(
			[
				`packages/d/package.json`,
				`packages/b/package.json`,
				`packages/a/package.json`,
				`packages/c/package.json`,
			],
			{},
			{ cwd, stdout: stdout2, stderr: stderr2, env },
			{ deps: {}, dryRun: false }
		);

		// Get stdout and stderr output.
		const err2 = stderr2.getContentsAsString("utf8");
		expect(err2).toBe(false);
		const out2 = stdout2.getContentsAsString("utf8");
		expect(out2).toMatch("Started multirelease! Loading 4 packages...");
		expect(out2).toMatch("Loaded package msr-test-a");
		expect(out2).toMatch("Loaded package msr-test-b");
		expect(out2).toMatch("Loaded package msr-test-c");
		expect(out2).toMatch("Loaded package msr-test-d");
		expect(out2).toMatch("Queued 4 packages! Starting release...");
		expect(out2).toMatch(`Created tag msr-test-a@1.1.0-${preReleaseBranch}.2`);
		// Default behavior minor bumps
		expect(out2).toMatch(`Created tag msr-test-b@1.0.1-${preReleaseBranch}.2`);
		expect(out2).toMatch(`Created tag msr-test-c@1.0.1-${preReleaseBranch}.2`);
		expect(out2).toMatch("There are no relevant changes, so no new version is released");
		expect(out2).toMatch("Released 3 of 4 packages, semantically!");

		// A.
		expect(result2[0].name).toBe("msr-test-a");
		expect(result2[0].result.lastRelease).toMatchObject({
			gitHead: sha2,
			gitTag: `msr-test-a@1.1.0-${preReleaseBranch}.1`,
			version: `1.1.0-${preReleaseBranch}.1`,
		});
		expect(result2[0].result.nextRelease).toMatchObject({
			gitHead: sha3,
			gitTag: `msr-test-a@1.1.0-${preReleaseBranch}.2`,
			type: "minor",
			version: `1.1.0-${preReleaseBranch}.2`,
		});
		expect(result2[0].result.nextRelease.notes).toMatch(`# msr-test-a [1.1.0-${preReleaseBranch}.2]`);
		expect(result2[0].result.nextRelease.notes).toMatch("### Features\n\n* **bbb:** Add missing text file");
		// expect(result[3].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-c:** upgraded to 1.0.1");

		// B.
		expect(result2[2].name).toBe("msr-test-b");
		expect(result2[2].result.lastRelease).toEqual({
			channels: [preReleaseBranch],
			gitHead: sha2,
			gitTag: `msr-test-b@1.0.1-${preReleaseBranch}.1`,
			name: `msr-test-b@1.0.1-${preReleaseBranch}.1`,
			version: `1.0.1-${preReleaseBranch}.1`,
		});
		expect(result2[2].result.nextRelease).toMatchObject({
			gitHead: sha3,
			gitTag: `msr-test-b@1.0.1-${preReleaseBranch}.2`,
			type: "patch",
			version: `1.0.1-${preReleaseBranch}.2`,
		});
		expect(result2[2].result.nextRelease.notes).toMatch(`# msr-test-b [1.0.1-${preReleaseBranch}.2]`);
		expect(result2[2].result.nextRelease.notes).not.toMatch("### Features");
		expect(result2[2].result.nextRelease.notes).not.toMatch("### Bug Fixes");
		expect(result2[2].result.nextRelease.notes).toMatch(
			`### Dependencies\n\n* **msr-test-a:** upgraded to 1.1.0-${preReleaseBranch}.2`
		);

		// C.
		expect(result2[3].name).toBe("msr-test-c");
		expect(result2[3].result.lastRelease).toEqual({
			channels: [preReleaseBranch],
			gitHead: sha2,
			gitTag: `msr-test-c@1.0.1-${preReleaseBranch}.1`,
			name: `msr-test-c@1.0.1-${preReleaseBranch}.1`,
			version: `1.0.1-${preReleaseBranch}.1`,
		});
		expect(result2[3].result.nextRelease).toMatchObject({
			gitHead: sha3,
			gitTag: `msr-test-c@1.0.1-${preReleaseBranch}.2`,
			type: "patch",
			version: `1.0.1-${preReleaseBranch}.2`,
		});
		expect(result2[3].result.nextRelease.notes).toMatch(`# msr-test-c [1.0.1-${preReleaseBranch}.2]`);
		expect(result2[3].result.nextRelease.notes).not.toMatch("### Features");
		expect(result2[3].result.nextRelease.notes).not.toMatch("### Bug Fixes");
		expect(result2[3].result.nextRelease.notes).toMatch(
			`### Dependencies\n\n* **msr-test-b:** upgraded to 1.0.1-${preReleaseBranch}.2`
		);

		// D.
		expect(result2[1].name).toBe("msr-test-d");
		expect(result2[1].result).toBe(false);

		// ONLY four times.
		expect(result2[4]).toBe(undefined);

		// Check manifests.
		expect(JSON.parse(readFileSync(`${cwd}/packages/a/package.json`).toString())).toMatchObject({
			peerDependencies: {
				"left-pad": "latest",
			},
		});
		expect(JSON.parse(readFileSync(`${cwd}/packages/b/package.json`).toString())).toMatchObject({
			dependencies: {
				"msr-test-a": `1.1.0-${preReleaseBranch}.2`,
			},
			devDependencies: {
				"msr-test-d": "1.0.0",
				"left-pad": "latest",
			},
		});
		expect(JSON.parse(readFileSync(`${cwd}/packages/c/package.json`).toString())).toMatchObject({
			devDependencies: {
				"msr-test-b": `1.0.1-${preReleaseBranch}.2`,
				"msr-test-d": "1.0.0",
			},
		});
	});

	// Bug state that we want to keep for now in case of other people who have triaged it
	test("Changes in some packages with bugged prerelease bumping (pullTagsForPrerelease: true)", async () => {
		const preReleaseBranch = "alpha";
		// Create Git repo.
		const cwd = gitInit(preReleaseBranch);
		// Initial commit.
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		addPrereleaseToPackageRootConfig(cwd, preReleaseBranch);

		const sha1 = gitCommitAll(cwd, "feat: Initial release");
		gitTag(cwd, "msr-test-a@1.0.0");
		gitTag(cwd, "msr-test-b@1.0.0");
		gitTag(cwd, "msr-test-c@1.0.0");
		gitTag(cwd, "msr-test-d@1.0.0");
		// Second commit.
		writeFileSync(`${cwd}/packages/a/aaa.txt`, "AAA");
		const sha2 = gitCommitAll(cwd, "feat(aaa): Add missing text file");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result = await multiSemanticRelease(
			[
				`packages/d/package.json`,
				`packages/b/package.json`,
				`packages/a/package.json`,
				`packages/c/package.json`,
			],
			{},
			{ cwd, stdout, stderr, env },
			{
				deps: {
					pullTagsForPrerelease: true,
				},
				dryRun: false,
			}
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 4 packages...");
		expect(out).toMatch("Loaded package msr-test-a");
		expect(out).toMatch("Loaded package msr-test-b");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 4 packages! Starting release...");
		expect(out).toMatch(`Created tag msr-test-a@1.1.0-${preReleaseBranch}.1`);
		expect(out).toMatch(`Created tag msr-test-b@1.0.1-${preReleaseBranch}.1`);
		expect(out).toMatch(`Created tag msr-test-c@1.0.1-${preReleaseBranch}.1`);
		expect(out).toMatch("There are no relevant changes, so no new version is released");
		expect(out).toMatch("Released 3 of 4 packages, semantically!");

		// A.
		expect(result[0].name).toBe("msr-test-a");
		expect(result[0].result.lastRelease).toMatchObject({
			gitHead: sha1,
			gitTag: "msr-test-a@1.0.0",
			version: "1.0.0",
		});
		expect(result[0].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: `msr-test-a@1.1.0-${preReleaseBranch}.1`,
			type: "minor",
			version: `1.1.0-${preReleaseBranch}.1`,
		});
		expect(result[0].result.nextRelease.notes).toMatch(`# msr-test-a [1.1.0-${preReleaseBranch}.1]`);
		expect(result[0].result.nextRelease.notes).toMatch("### Features\n\n* **aaa:** Add missing text file");
		// expect(result[3].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-c:** upgraded to 1.0.1");

		// B.
		expect(result[2].name).toBe("msr-test-b");
		expect(result[2].result.lastRelease).toEqual({
			channels: [null],
			gitHead: sha1,
			gitTag: "msr-test-b@1.0.0",
			name: "msr-test-b@1.0.0",
			version: "1.0.0",
		});
		expect(result[2].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: `msr-test-b@1.0.1-${preReleaseBranch}.1`,
			type: "patch",
			version: `1.0.1-${preReleaseBranch}.1`,
		});
		expect(result[2].result.nextRelease.notes).toMatch(`# msr-test-b [1.0.1-${preReleaseBranch}.1]`);
		expect(result[2].result.nextRelease.notes).not.toMatch("### Features");
		expect(result[2].result.nextRelease.notes).not.toMatch("### Bug Fixes");
		expect(result[2].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-a:** upgraded to 1.1.0");

		// C.
		expect(result[3].name).toBe("msr-test-c");
		expect(result[3].result.lastRelease).toEqual({
			channels: [null],
			gitHead: sha1,
			gitTag: "msr-test-c@1.0.0",
			name: "msr-test-c@1.0.0",
			version: "1.0.0",
		});
		expect(result[3].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: `msr-test-c@1.0.1-${preReleaseBranch}.1`,
			type: "patch",
			version: `1.0.1-${preReleaseBranch}.1`,
		});
		expect(result[3].result.nextRelease.notes).toMatch(`# msr-test-c [1.0.1-${preReleaseBranch}.1]`);
		expect(result[3].result.nextRelease.notes).not.toMatch("### Features");
		expect(result[3].result.nextRelease.notes).not.toMatch("### Bug Fixes");
		expect(result[3].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-b:** upgraded to 1.0.1");

		// D.
		expect(result[1].name).toBe("msr-test-d");
		expect(result[1].result).toBe(false);

		// ONLY four times.
		expect(result[4]).toBe(undefined);

		// Check manifests.
		expect(require(`${cwd}/packages/a/package.json`)).toMatchObject({
			peerDependencies: {
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/b/package.json`)).toMatchObject({
			dependencies: {
				"msr-test-a": `1.1.0-${preReleaseBranch}.1`,
			},
			devDependencies: {
				"msr-test-d": "1.0.0",
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			devDependencies: {
				"msr-test-b": `1.0.1-${preReleaseBranch}.1`,
				"msr-test-d": "1.0.0",
			},
		});

		// Commit this like the git plugin would (with a skippable syntax)
		gitCommitAll(cwd, "docs(release): Release everything");

		// Release a second time to verify prerelease incrementation
		writeFileSync(`${cwd}/packages/a/bbb.txt`, "BBB");
		const sha3 = gitCommitAll(cwd, "feat(bbb): Add missing text file");
		gitPush(cwd);

		// Capture output.
		const stdout2 = new WritableStreamBuffer();
		const stderr2 = new WritableStreamBuffer();

		// NOTE: we call this again because we want to verify semantic-release
		//       channel tagging instead of simulating
		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result2 = await multiSemanticRelease(
			[
				`packages/d/package.json`,
				`packages/b/package.json`,
				`packages/a/package.json`,
				`packages/c/package.json`,
			],
			{},
			{ cwd, stdout: stdout2, stderr: stderr2, env },
			{
				deps: {
					pullTagsForPrerelease: true,
				},
				dryRun: false,
			}
		);

		// Get stdout and stderr output.
		const err2 = stderr2.getContentsAsString("utf8");
		expect(err2).toBe(false);
		const out2 = stdout2.getContentsAsString("utf8");
		expect(out2).toMatch("Started multirelease! Loading 4 packages...");
		expect(out2).toMatch("Loaded package msr-test-a");
		expect(out2).toMatch("Loaded package msr-test-b");
		expect(out2).toMatch("Loaded package msr-test-c");
		expect(out2).toMatch("Loaded package msr-test-d");
		expect(out2).toMatch("Queued 4 packages! Starting release...");
		expect(out2).toMatch(`Created tag msr-test-a@1.1.0-${preReleaseBranch}.2`);
		// Default behavior minor bumps
		expect(out2).toMatch(`Created tag msr-test-b@1.0.1-${preReleaseBranch}.2`);
		expect(out2).toMatch(`Created tag msr-test-c@1.0.1-${preReleaseBranch}.2`);
		expect(out2).toMatch("There are no relevant changes, so no new version is released");
		expect(out2).toMatch("Released 3 of 4 packages, semantically!");

		// A.
		expect(result2[0].name).toBe("msr-test-a");
		expect(result2[0].result.lastRelease).toMatchObject({
			gitHead: sha2,
			gitTag: `msr-test-a@1.1.0-${preReleaseBranch}.1`,
			version: `1.1.0-${preReleaseBranch}.1`,
		});
		expect(result2[0].result.nextRelease).toMatchObject({
			gitHead: sha3,
			gitTag: `msr-test-a@1.1.0-${preReleaseBranch}.2`,
			type: "minor",
			version: `1.1.0-${preReleaseBranch}.2`,
		});
		expect(result2[0].result.nextRelease.notes).toMatch(`# msr-test-a [1.1.0-${preReleaseBranch}.2]`);
		expect(result2[0].result.nextRelease.notes).toMatch("### Features\n\n* **bbb:** Add missing text file");
		// expect(result[3].result.nextRelease.notes).toMatch("### Dependencies\n\n* **msr-test-c:** upgraded to 1.0.1");

		// B.
		expect(result2[2].name).toBe("msr-test-b");
		expect(result2[2].result.lastRelease).toEqual({
			channels: [preReleaseBranch],
			gitHead: sha2,
			gitTag: `msr-test-b@1.0.1-${preReleaseBranch}.1`,
			name: `msr-test-b@1.0.1-${preReleaseBranch}.1`,
			version: `1.0.1-${preReleaseBranch}.1`,
		});
		expect(result2[2].result.nextRelease).toMatchObject({
			gitHead: sha3,
			gitTag: `msr-test-b@1.0.1-${preReleaseBranch}.2`,
			type: "patch",
			version: `1.0.1-${preReleaseBranch}.2`,
		});
		expect(result2[2].result.nextRelease.notes).toMatch(`# msr-test-b [1.0.1-${preReleaseBranch}.2]`);
		expect(result2[2].result.nextRelease.notes).not.toMatch("### Features");
		expect(result2[2].result.nextRelease.notes).not.toMatch("### Bug Fixes");
		expect(result2[2].result.nextRelease.notes).toMatch(
			`### Dependencies\n\n* **msr-test-a:** upgraded to 1.1.0-${preReleaseBranch}.2`
		);

		// C.
		expect(result2[3].name).toBe("msr-test-c");
		expect(result2[3].result.lastRelease).toEqual({
			channels: [preReleaseBranch],
			gitHead: sha2,
			gitTag: `msr-test-c@1.0.1-${preReleaseBranch}.1`,
			name: `msr-test-c@1.0.1-${preReleaseBranch}.1`,
			version: `1.0.1-${preReleaseBranch}.1`,
		});
		expect(result2[3].result.nextRelease).toMatchObject({
			gitHead: sha3,
			gitTag: `msr-test-c@1.0.1-${preReleaseBranch}.2`,
			type: "patch",
			version: `1.0.1-${preReleaseBranch}.2`,
		});
		expect(result2[3].result.nextRelease.notes).toMatch(`# msr-test-c [1.0.1-${preReleaseBranch}.2]`);
		expect(result2[3].result.nextRelease.notes).not.toMatch("### Features");
		expect(result2[3].result.nextRelease.notes).not.toMatch("### Bug Fixes");
		expect(result2[3].result.nextRelease.notes).toMatch(
			`### Dependencies\n\n* **msr-test-b:** upgraded to 1.0.1-${preReleaseBranch}.2`
		);

		// D.
		expect(result2[1].name).toBe("msr-test-d");
		expect(result2[1].result).toBe(false);

		// ONLY four times.
		expect(result2[4]).toBe(undefined);

		const pkgA = JSON.parse(readFileSync(`${cwd}/packages/a/package.json`).toString());
		const pkgB = JSON.parse(readFileSync(`${cwd}/packages/b/package.json`).toString());
		const pkgC = JSON.parse(readFileSync(`${cwd}/packages/c/package.json`).toString());
		// Check manifests. (They have non-existent state)
		expect(JSON.parse(readFileSync(`${cwd}/packages/a/package.json`).toString())).toMatchObject({
			peerDependencies: {
				"left-pad": "latest",
			},
		});
		expect(JSON.parse(readFileSync(`${cwd}/packages/b/package.json`).toString())).toMatchObject({
			dependencies: {
				"msr-test-a": `1.1.0-${preReleaseBranch}.3`,
			},
			devDependencies: {
				"msr-test-d": "1.0.0",
				"left-pad": "latest",
			},
		});
		expect(JSON.parse(readFileSync(`${cwd}/packages/c/package.json`).toString())).toMatchObject({
			devDependencies: {
				"msr-test-b": `1.0.1-${preReleaseBranch}.3`,
				"msr-test-d": "1.0.0",
			},
		});
	});

	test("Changes in child packages with sequentialPrepare", async () => {
		const mockPrepare = jest.fn();
		// Create Git repo.
		const cwd = gitInit();
		// Initial commit.
		copyDirectory(`test/fixtures/yarnWorkspaces2Packages/`, cwd);
		const sha1 = gitCommitAll(cwd, "feat: Initial release");
		gitTag(cwd, "msr-test-c@1.0.0");
		gitTag(cwd, "msr-test-d@1.0.0");
		// Second commit.
		writeFileSync(`${cwd}/packages/d/aaa.txt`, "AAA");
		const sha2 = gitCommitAll(cwd, "feat(aaa): Add missing text file");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result = await multiSemanticRelease(
			[`packages/c/package.json`, `packages/d/package.json`],
			{
				plugins: [
					{
						// Ensure that msr-test-c is always ready before msr-test-d
						verify: (_, { lastRelease: { name } }) =>
							new Promise((resolvePromise) => {
								if (name.split("@")[0] === "msr-test-c") {
									resolvePromise();
								}

								setTimeout(resolvePromise, 5000);
							}),
					},
					{
						prepare: (_, { lastRelease: { name } }) => {
							mockPrepare(name.split("@")[0]);
						},
					},
				],
			},
			{ cwd, stdout, stderr, env },
			{ deps: {}, dryRun: false, sequentialPrepare: true }
		);

		expect(mockPrepare).toHaveBeenNthCalledWith(1, "msr-test-d");
		expect(mockPrepare).toHaveBeenNthCalledWith(2, "msr-test-c");

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 2 packages...");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 2 packages! Starting release...");
		expect(out).toMatch("Created tag msr-test-d@1.1.0");
		expect(out).toMatch("Created tag msr-test-c@1.0.1");
		expect(out).toMatch("Released 2 of 2 packages, semantically!");

		// C.
		expect(result[1].name).toBe("msr-test-c");
		expect(result[1].result.lastRelease).toMatchObject({
			gitHead: sha1,
			gitTag: "msr-test-c@1.0.0",
			version: "1.0.0",
		});
		expect(result[1].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: "msr-test-c@1.0.1",
			type: "patch",
			version: "1.0.1",
		});

		// D.
		expect(result[0].name).toBe("msr-test-d");
		expect(result[0].result.lastRelease).toEqual({
			channels: [null],
			gitHead: sha1,
			gitTag: "msr-test-d@1.0.0",
			name: "msr-test-d@1.0.0",
			version: "1.0.0",
		});
		expect(result[0].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: "msr-test-d@1.1.0",
			type: "minor",
			version: "1.1.0",
		});

		// ONLY three times.
		expect(result[2]).toBe(undefined);

		// Check manifests.
		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			dependencies: {
				"msr-test-d": "1.1.0",
			},
		});
	});

	test("Changes in parent packages with sequentialPrepare", async () => {
		// Create Git repo.
		const cwd = gitInit();
		// Initial commit.
		copyDirectory(`test/fixtures/yarnWorkspaces2Packages/`, cwd);
		const sha1 = gitCommitAll(cwd, "feat: Initial release");
		gitTag(cwd, "msr-test-c@1.0.0");
		gitTag(cwd, "msr-test-d@1.0.0");
		// Second commit.
		writeFileSync(`${cwd}/packages/c/aaa.txt`, "AAA");
		const sha2 = gitCommitAll(cwd, "feat(aaa): Add missing text file");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result = await multiSemanticRelease(
			null,
			{},
			{ cwd, stdout, stderr, env },
			{ deps: {}, dryRun: false, sequentialPrepare: true }
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Started multirelease! Loading 2 packages...");
		expect(out).toMatch("Loaded package msr-test-c");
		expect(out).toMatch("Loaded package msr-test-d");
		expect(out).toMatch("Queued 2 packages! Starting release...");
		expect(out).toMatch("Created tag msr-test-c@1.1.0");
		expect(out).toMatch("Released 1 of 2 packages, semantically!");

		// C.
		expect(result[1].name).toBe("msr-test-c");
		expect(result[1].result.lastRelease).toMatchObject({
			gitHead: sha1,
			gitTag: "msr-test-c@1.0.0",
			version: "1.0.0",
		});
		expect(result[1].result.nextRelease).toMatchObject({
			gitHead: sha2,
			gitTag: "msr-test-c@1.1.0",
			type: "minor",
			version: "1.1.0",
		});

		// D.
		expect(result[0].name).toBe("msr-test-d");
		expect(result[0].result.nextRelease).toBeUndefined();

		// ONLY two times.
		expect(result[2]).toBe(undefined);
	});

	test("Changes in some packages (sequential-init)", async () => {
		// Create Git repo.
		const cwd = gitInit();
		// Initial commit.
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		const sha1 = gitCommitAll(cwd, "feat: Initial release");
		gitTag(cwd, "msr-test-a@1.0.0");
		gitTag(cwd, "msr-test-b@1.0.0");
		gitTag(cwd, "msr-test-c@1.0.0");
		gitTag(cwd, "msr-test-d@1.0.0");
		// Second commit.
		writeFileSync(`${cwd}/packages/a/aaa.txt`, "AAA");
		const sha2 = gitCommitAll(cwd, "feat(aaa): Add missing text file");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		const result = await multiSemanticRelease(
			[
				`packages/c/package.json`,
				`packages/d/package.json`,
				`packages/b/package.json`,
				`packages/a/package.json`,
			],
			{},
			{ cwd, stdout, stderr, env },
			{ sequentialInit: true }
		);

		// Check manifests.
		expect(require(`${cwd}/packages/a/package.json`)).toMatchObject({
			peerDependencies: {
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/b/package.json`)).toMatchObject({
			version: "1.0.1",
			dependencies: {
				"msr-test-a": "1.1.0",
			},
			devDependencies: {
				"msr-test-d": "1.0.0",
				"left-pad": "latest",
			},
		});
		expect(require(`${cwd}/packages/c/package.json`)).toMatchObject({
			version: "1.0.1",
			devDependencies: {
				"msr-test-b": "1.0.1",
				"msr-test-d": "1.0.0",
			},
		});
	});
	test("Error if release's local deps have no version number", async () => {
		// Create Git repo with copy of Yarn workspaces fixture.
		const cwd = gitInit();
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		gitAdd(cwd, "packages/c/package.json");
		const sha = gitCommit(cwd, "feat: Commit c package only");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		try {
			const result = await multiSemanticRelease(null, {}, { cwd, stdout, stderr, env });

			// Not reached.
			expect(false).toBe(true);
		} catch (e) {
			expect(e.message).toBe("Cannot release msr-test-c because dependency msr-test-b has not been released yet");
		}
	});
	test("Configured plugins are called as normal", async () => {
		// Create Git repo with copy of Yarn workspaces fixture.
		const cwd = gitInit();
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		const sha = gitCommitAll(cwd, "feat: Initial release");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Make an inline plugin.
		const plugin = {
			verifyConditions: jest.fn(),
			analyzeCommits: jest.fn(),
			verifyRelease: jest.fn(),
			generateNotes: jest.fn(),
			prepare: jest.fn(),
			success: jest.fn(),
			fail: jest.fn(),
		};

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		const result = await multiSemanticRelease(
			[`packages/d/package.json`],
			{
				// Override to add our own plugins.
				plugins: ["@semantic-release/release-notes-generator", plugin],
				analyzeCommits: ["@semantic-release/commit-analyzer"],
			},
			{ cwd, stdout, stderr, env }
		);

		// Check calls.
		expect(plugin.verifyConditions).toBeCalledTimes(1);
		expect(plugin.analyzeCommits).toBeCalledTimes(0); // NOTE overridden
		expect(plugin.verifyRelease).toBeCalledTimes(1);
		expect(plugin.generateNotes).toBeCalledTimes(1);
		expect(plugin.prepare).toBeCalledTimes(1);
		expect(plugin.success).toBeCalledTimes(1);
		expect(plugin.fail).not.toBeCalled();
	});
	test("Bot commit release note should filetered", async () => {
		// Create Git repo.
		const cwd = gitInit();
		// Initial commit.
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		const sha1 = gitCommitAll(cwd, "feat: Initial release");
		gitTag(cwd, "msr-test-a@1.0.0");
		gitTag(cwd, "msr-test-b@1.0.0");
		gitTag(cwd, "msr-test-c@1.0.0");
		gitTag(cwd, "msr-test-d@1.0.0");
		// Second commit.
		writeFileSync(`${cwd}/packages/a/aaa.txt`, "AAA");
		const sha2 = gitCommitAll(cwd, "feat(aaa): Add missing text file");

		// Third commit.
		writeFileSync(`${cwd}/packages/b/bbb.txt`, "BBB");
		const sha3 = gitCommitAll(cwd, "feat(bbb): Add missing text file");

		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Call multiSemanticRelease()
		// Include "@semantic-release/git" for made the git head changed
		const result = await multiSemanticRelease(
			[
				`packages/c/package.json`,
				`packages/d/package.json`,
				`packages/b/package.json`,
				`packages/a/package.json`,
			],
			{
				plugins: [
					"@semantic-release/release-notes-generator",
					"@semantic-release/changelog",
					"@semantic-release/git",
				],
				analyzeCommits: ["@semantic-release/commit-analyzer"],
			},
			{ cwd, stdout, stderr, env },
			{ deps: {}, dryRun: false }
		);

		const logOutput = gitGetLog(cwd, 3, "HEAD");
		expect(logOutput).not.toMatch(/.*aaa.*Add missing text file.*\n.*bbb.*Add missing text file.*/);
	});
	test("Deep errors (e.g. in plugins) bubble up and out", async () => {
		// Create Git repo with copy of Yarn workspaces fixture.
		const cwd = gitInit();
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		const sha = gitCommitAll(cwd, "feat: Initial release");
		const url = gitInitOrigin(cwd);
		gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		// Release.

		// Call multiSemanticRelease()
		// Doesn't include plugins that actually publish.
		try {
			await multiSemanticRelease(
				[`packages/d/package.json`, `packages/a/package.json`],
				{
					// Override to add our own erroring plugin.
					plugins: [
						{
							analyzeCommits: () => {
								throw new Error("NOPE");
							},
						},
					],
				},
				{ cwd, stdout, stderr, env }
			);

			// Not reached.
			expect(false).toBe(true);
		} catch (e) {
			// Error bubbles up through semantic-release and multi-semantic-release and out.

			expect(e.message).toBe("NOPE");
		}
	});
	test("TypeError if CWD is not string", async () => {
		await expect(multiSemanticRelease(null, {}, { cwd: 123 })).rejects.toBeInstanceOf(TypeError);
		await expect(multiSemanticRelease(null, {}, { cwd: true })).rejects.toBeInstanceOf(TypeError);
		await expect(multiSemanticRelease(null, {}, { cwd: [] })).rejects.toBeInstanceOf(TypeError);
	});
	test("TypeError if paths is not a list of strings", async () => {
		await expect(multiSemanticRelease(123)).rejects.toBeInstanceOf(TypeError);
		await expect(multiSemanticRelease("string")).rejects.toBeInstanceOf(TypeError);
		await expect(multiSemanticRelease(true)).rejects.toBeInstanceOf(TypeError);
		await expect(multiSemanticRelease([1, 2, 3])).rejects.toBeInstanceOf(TypeError);
		await expect(multiSemanticRelease([true, false])).rejects.toBeInstanceOf(TypeError);
		await expect(multiSemanticRelease([undefined])).rejects.toBeInstanceOf(TypeError);
		await expect(multiSemanticRelease([null])).rejects.toBeInstanceOf(TypeError);
	});
	test("ReferenceError if paths points to a non-file", async () => {
		const stdout = new WritableStreamBuffer(); // Blackhole the output so it doesn't clutter Jest.
		const r1 = multiSemanticRelease(["test/fixtures/DOESNOTEXIST.json"], {}, { stdout });
		await expect(r1).rejects.toBeInstanceOf(ReferenceError); // Path that does not exist.
		const r2 = multiSemanticRelease(["test/fixtures/DOESNOTEXIST/"], {}, { stdout });
		await expect(r2).rejects.toBeInstanceOf(ReferenceError); // Path that does not exist.
		const r3 = multiSemanticRelease(["test/fixtures/"], {}, { stdout });
		await expect(r3).rejects.toBeInstanceOf(ReferenceError); // Directory that exists.
	});
	test("SyntaxError if paths points to package.json with bad syntax", async () => {
		const stdout = new WritableStreamBuffer(); // Blackhole the output so it doesn't clutter Jest.
		const r1 = multiSemanticRelease(["test/fixtures/invalidPackage.json"], {}, { stdout });
		await expect(r1).rejects.toBeInstanceOf(SyntaxError);
		await expect(r1).rejects.toMatchObject({
			message: expect.stringMatching("could not be parsed"),
		});
		const r2 = multiSemanticRelease(["test/fixtures/numberPackage.json"], {}, { stdout });
		await expect(r2).rejects.toBeInstanceOf(SyntaxError);
		await expect(r2).rejects.toMatchObject({
			message: expect.stringMatching("not an object"),
		});
		const r3 = multiSemanticRelease(["test/fixtures/badNamePackage.json"], {}, { stdout });
		await expect(r3).rejects.toBeInstanceOf(SyntaxError);
		await expect(r3).rejects.toMatchObject({
			message: expect.stringMatching("Package name must be non-empty string"),
		});
		const r4 = multiSemanticRelease(["test/fixtures/badDepsPackage.json"], {}, { stdout });
		await expect(r4).rejects.toBeInstanceOf(SyntaxError);
		await expect(r4).rejects.toMatchObject({
			message: expect.stringMatching("Package dependencies must be object"),
		});
		const r5 = multiSemanticRelease(["test/fixtures/badDevDepsPackage.json"], {}, { stdout });
		await expect(r5).rejects.toBeInstanceOf(SyntaxError);
		await expect(r5).rejects.toMatchObject({
			message: expect.stringMatching("Package devDependencies must be object"),
		});
		const r6 = multiSemanticRelease(["test/fixtures/badPeerDepsPackage.json"], {}, { stdout });
		await expect(r6).rejects.toBeInstanceOf(SyntaxError);
		await expect(r6).rejects.toMatchObject({
			message: expect.stringMatching("Package peerDependencies must be object"),
		});
	});

	// test("ValueError if sequentialPrepare is enabled on a cyclic project", async () => {
	// 	// Create Git repo with copy of Yarn workspaces fixture.
	// 	const cwd = gitInit();
	// 	copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
	// 	const sha = gitCommitAll(cwd, "feat: Initial release");
	// 	const url = gitInitOrigin(cwd);
	// 	gitPush(cwd);
	//
	// 	// Capture output.
	// 	const stdout = new WritableStreamBuffer();
	// 	const stderr = new WritableStreamBuffer();
	//
	// 	// Call multiSemanticRelease()
	// 	// Doesn't include plugins that actually publish.
	// 	const result = multiSemanticRelease(
	// 		[
	// 			`packages/a/package.json`,
	// 			`packages/b/package.json`,
	// 			`packages/c/package.json`,
	// 			`packages/d/package.json`,
	// 		],
	// 		{},
	// 		{ cwd, stdout, stderr },
	// 		{ sequentialPrepare: true, deps: {} }
	// 	);
	//
	// 	await expect(result).rejects.toBeInstanceOf(ValueError);
	// 	await expect(result).rejects.toMatchObject({
	// 		message: expect.stringMatching("can't have cyclic with sequentialPrepare option"),
	// 	});
	// });

	test("Generated tag with custom version format", async () => {
		// Create Git repo with copy of Yarn workspaces fixture.
		const cwd = await gitInit();
		copyDirectory(`test/fixtures/yarnWorkspaces/`, cwd);
		await gitCommitAll(cwd, "feat: Initial release");
		await gitInitOrigin(cwd);
		await gitPush(cwd);

		// Capture output.
		const stdout = new WritableStreamBuffer();
		const stderr = new WritableStreamBuffer();

		await multiSemanticRelease(
			[`packages/a/package.json`],
			{},
			{ cwd, stdout, stderr, env },
			{ tagFormat: "${name}/${version}", deps: {} }
		);

		// Get stdout and stderr output.
		const err = stderr.getContentsAsString("utf8");
		expect(err).toBe(false);
		const out = stdout.getContentsAsString("utf8");
		expect(out).toMatch("Created tag msr-test-a/1.0.0");
	});
});
