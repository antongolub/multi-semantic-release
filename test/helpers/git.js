/**
 * Lifted and tweaked from semantic-release because we follow how they test their internals.
 * https://github.com/semantic-release/semantic-release/blob/master/test/helpers/git-utils.js
 */

import { check } from "blork";
import { temporaryDirectory } from "tempy";
import { execaSync } from "execa";
import fileUrl from "file-url";
import gitLogParser from "git-log-parser";
import { array as getStreamArray } from "get-stream";

/**
 * @typedef {Object} Commit
 * @property {string} branch The commit branch.
 * @property {string} hash The commit hash.
 * @property {string} message The commit message.
 */

// Init.

/**
 * Create a Git repository.
 * _Created in a temp folder._
 *
 * @param {string} branch="master" The branch to initialize the repository to.
 * @return {Promise<string>} Promise that resolves to string pointing to the CWD for the created Git repository.
 */
function gitInit(branch = "master") {
	// Check params.
	check(branch, "branch: kebab");

	// Init Git in a temp directory.
	const cwd = temporaryDirectory();
	execaSync("git", ["init"], { cwd });
	execaSync("git", ["checkout", "-b", branch], { cwd });

	// Disable GPG signing for commits.
	gitConfig(cwd, "commit.gpgsign", false);
	gitUser(cwd);

	// Return directory.
	return cwd;
}

/**
 * Create a remote Git repository.
 * _Created in a temp folder._
 *
 * @return {Promise<string>} Promise that resolves to string URL of the of the remote origin.
 */
function gitInitRemote() {
	// Init bare Git repository in a temp directory.
	const cwd = temporaryDirectory();
	execaSync("git", ["init", "--bare"], { cwd });

	// Turn remote path into a file URL.
	const url = fileUrl(cwd);

	// Return URL for remote.
	return url;
}

/**
 * Create a remote Git repository and set it as the origin for a Git repository.
 * _Created in a temp folder._
 *
 * @param {string} cwd The cwd to create and set the origin for.
 * @param {string} releaseBranch="null" Optional branch to be added in case of prerelease is activated for a branch.
 * @return {Promise<string>} Promise that resolves to string URL of the of the remote origin.
 */
function gitInitOrigin(cwd, releaseBranch = null) {
	// Check params.
	check(cwd, "cwd: absolute");

	// Turn remote path into a file URL.
	const url = gitInitRemote();

	// Set origin on local repo.
	execaSync("git", ["remote", "add", "origin", url], { cwd });

	// Set up a release branch. Return to master afterwards.
	if (releaseBranch) {
		execaSync("git", ["checkout", "-b", releaseBranch], { cwd });
		execaSync("git", ["checkout", "master"], { cwd });
	}

	execaSync("git", ["push", "--all", "origin"], { cwd });

	// Return URL for remote.
	return url;
}

// Add.

/**
 * Add files to staged commit in a Git repository.
 *
 * @param {string} cwd The cwd to create and set the origin for.
 * @param {string} file="." The file to add, defaulting to "." (all files).
 * @return {Promise<void>} Promise that resolves when done.
 */
function gitAdd(cwd, file = ".") {
	// Check params.
	check(cwd, "cwd: absolute");

	// Await command.
	execaSync("git", ["add", file], { cwd });
}

// Commits.

/**
 * Create commit on a Git repository.
 * _Allows empty commits without any files added._
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} message Commit message.
 * @returns {Promise<string>} Promise that resolves to the SHA for the commit.
 */
function gitCommit(cwd, message) {
	// Check params.
	check(cwd, "cwd: absolute");
	check(message, "message: string+");

	// Await the command.
	execaSync("git", ["commit", "-m", message, "--no-gpg-sign"], { cwd });

	// Return HEAD SHA.
	return gitGetHead(cwd);
}

/**
 * `git add .` followed by `git commit`
 * _Allows empty commits without any files added._
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} message Commit message.
 * @returns {Promise<string>} Promise that resolves to the SHA for the commit.
 */
function gitCommitAll(cwd, message) {
	// Check params.
	check(cwd, "cwd: absolute");
	check(message, "message: string+");

	// Await command.
	gitAdd(cwd);

	// Await command and return the SHA hash.
	return gitCommit(cwd, message);
}

// Push.

/**
 * Push to a remote Git repository.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} remote The remote repository URL or name.
 * @param {string} branch The branch to push.
 * @returns {Promise<void>} Promise that resolves when done.
 * @throws {Error} if the push failed.
 */
function gitPush(cwd, remote = "origin", branch = "master") {
	// Check params.
	check(cwd, "cwd: absolute");
	check(remote, "remote: string");
	check(branch, "branch: lower");

	// Await command.
	execaSync("git", ["push", "--tags", remote, `HEAD:${branch}`], { cwd });
}

/**
 * Sets git user data.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} name Committer name.
 * @param {string} email Committer email.
 * @returns {void} Return void.
 */
function gitUser(cwd, name = "Foo Bar", email = "email@foo.bar") {
	execaSync("git", ["config", "--local", "user.email", email], { cwd });
	execaSync("git", ["config", "--local", "user.name", name], { cwd });
}

// Branches.

/**
 * Create a branch in a local Git repository.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} branch Branch name to create.
 * @returns {Promise<void>} Promise that resolves when done.
 */
function gitBranch(cwd, branch) {
	// Check params.
	check(cwd, "cwd: absolute");
	check(branch, "branch: lower");

	// Await command.
	execaSync("git", ["branch", branch], { cwd });
}

/**
 * Checkout a branch in a local Git repository.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} branch Branch name to checkout.
 * @returns {Promise<void>} Promise that resolves when done.
 */
function gitCheckout(cwd, branch) {
	// Check params.
	check(cwd, "cwd: absolute");
	check(branch, "branch: lower");

	// Await command.
	execaSync("git", ["checkout", branch], { cwd });
}

// Hashes.

/**
 * Get the current HEAD SHA in a local Git repository.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @return {Promise<string>} Promise that resolves to the SHA of the head commit.
 */
function gitGetHead(cwd) {
	// Check params.
	check(cwd, "cwd: absolute");

	// Await command and return HEAD SHA.
	return execaSync("git", ["rev-parse", "HEAD"], { cwd }).stdout;
}

// Tags.

/**
 * Create a tag on the HEAD commit in a local Git repository.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} tagName The tag name to create.
 * @param {string} hash=false SHA for the commit on which to create the tag. If falsy the tag is created on the latest commit.
 * @returns {Promise<void>} Promise that resolves when done.
 */
function gitTag(cwd, tagName, hash = undefined) {
	// Check params.
	check(cwd, "cwd: absolute");
	check(tagName, "tagName: string+");
	check(hash, "hash: alphanumeric{40}?");

	// Run command.
	execaSync("git", hash ? ["tag", "-f", tagName, hash] : ["tag", tagName], { cwd });
}

/**
 * Get the tag associated with a commit SHA.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} hash The commit SHA for which to retrieve the associated tag.
 * @return {Promise<string>} The tag associated with the SHA in parameter or `null`.
 */
function gitGetTags(cwd, hash) {
	// Check params.
	check(cwd, "cwd: absolute");
	check(hash, "hash: alphanumeric{40}");

	// Run command.
	return execaSync("git", ["describe", "--tags", "--exact-match", hash], { cwd }).stdout;
}

/**
 * Get the first commit SHA tagged `tagName` in a local Git repository.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} tagName Tag name for which to retrieve the commit sha.
 * @return {Promise<string>} Promise that resolves to the SHA of the first commit associated with `tagName`.
 */
function gitGetTagHash(cwd, tagName) {
	// Check params.
	check(cwd, "cwd: absolute");
	check(tagName, "tagName: string+");

	// Run command.
	return execaSync("git", ["rev-list", "-1", tagName], { cwd }).stdout;
}

// Configs.

/**
 * Add a Git config setting.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} name Config name.
 * @param {any} value Config value.
 * @returns {Promise<void>} Promise that resolves when done.
 */
function gitConfig(cwd, name, value) {
	// Check params.
	check(cwd, "cwd: absolute");
	check(name, "name: string+");

	// Run command.
	execaSync("git", ["config", "--add", name, value], { cwd });
}

/**
 * Get a Git config setting.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {string} name Config name.
 * @returns {Promise<void>} Promise that resolves when done.
 */
function gitGetConfig(cwd, name) {
	// Check params.
	check(cwd, "cwd: absolute");
	check(name, "name: string+");

	// Run command.
	execaSync("git", ["config", name], { cwd }).stdout;
}

/**
 * Get the commit message log of given commit SHA or branch name.
 *
 * @param {string} cwd The CWD of the Git repository.
 * @param {integer} number Limit the number of commits to output.
 * @param {string} hash The commit SHA or branch name.
 * @return {Promise<string>} Promise that resolve to commit log message.
 */
function gitGetLog(cwd, number, hash) {
	check(cwd, "cwd: absolute");
	check(number, "number: integer");
	check(hash, "hash: string+");

	// Run command.
	return execaSync("git", ["log", `-${number}`, hash], { cwd }).stdout;
}
// Exports.
export {
	gitInit,
	gitInitRemote,
	gitInitOrigin,
	gitAdd,
	gitCommit,
	gitCommitAll,
	gitPush,
	gitCheckout,
	gitGetHead,
	gitGetTags,
	gitTag,
	gitGetTagHash,
	gitConfig,
	gitGetConfig,
	gitGetLog,
};
