import { basename, join, resolve } from "path";
import { copyFileSync, existsSync, mkdirSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "fs";

// Deep copy a directory.
function copyDirectory(source, target) {
	// Checks.
	if (!isDirectory(source)) throw new Error("copyDirectory(): source must be an existant directory");
	if (!isDirectory(target)) {
		// Try making it now (Tempy doesn't actually make the dir, just generates the path).
		mkdirSync(target);
		// If it doesn't exist after that there's an issue.
		if (!isDirectory(target)) throw new Error("copyDirectory(): target must be an existant directory");
	}

	// Copy every file and dir in the dir.
	readdirSync(source).forEach((name) => {
		// Get full paths.
		const sourceFile = join(source, name);
		const targetFile = join(target, name);

		// Directory or file?
		if (isDirectory(sourceFile)) {
			// Possibly make directory.
			if (!existsSync(targetFile)) mkdirSync(targetFile);
			// Recursive copy directory.
			copyDirectory(sourceFile, targetFile);
		} else {
			// Copy file.
			copyFileSync(sourceFile, targetFile);
		}
	});
}

// Is given path a directory?
function isDirectory(path) {
	// String path that exists and is a directory.
	return typeof path === "string" && existsSync(path) && lstatSync(path).isDirectory();
}

// Creates testing files on all specified folders.
function createNewTestingFiles(folders, cwd) {
	folders.forEach((fld) => {
		writeFileSync(`${cwd}/${fld}test.txt`, `${fld}${Math.random()}`);
	});
}

function addPrereleaseToPackageRootConfig(rootDir, releaseBranch) {
	const packageUri = resolve(join(rootDir, "package.json"));
	const packageJson = JSON.parse(readFileSync(packageUri).toString());

	packageJson.release.branches = ["master", { name: releaseBranch, prerelease: true }];
}

// Exports.
export { copyDirectory, isDirectory, createNewTestingFiles, addPrereleaseToPackageRootConfig };
