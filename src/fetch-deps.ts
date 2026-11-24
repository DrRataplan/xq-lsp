/**
 * The `xq-lsp fetch-deps` subcommand: reads the `<dependency package="…"/>` entries of an
 * EXPath `expath-pkg.xml`, resolves each one by package name URI against an EXPath package
 * repository's index (by default eXist-db's public-repo), and unpacks the XARs into a local directory so the
 * linter and language server can resolve `import module` against their XQuery sources.
 *
 * Packages are unpacked into `<out>/<abbrev>/`; the workspace indexes the XQuery files under each package's `content/` directory.
 * Dependencies of unpacked packages are fetched too. Packages the repository cannot
 * resolve (or non-XQuery ones, e.g. Java extension modules) are reported and skipped —
 * never fatal, so linting can still proceed.
 */
import * as fs from "fs";
import * as path from "path";
import * as slimdom from "slimdom";
import { unzip } from "./zip.ts";

export const DEFAULT_DEPS_DIR = ".xq-deps";
export const DEFAULT_EXIST_VERSION = "6.0.0";
export const DEFAULT_REPO_URL = "https://exist-db.org/exist/apps/public-repo";
const PKG_NS = "http://expath.org/ns/pkg";

export interface PackageDependency {
	/** Package name URI (`<dependency package="…">`). */
	name: string;
	semverMin?: string;
	semverMax?: string;
	semver?: string;
}

export interface PackageInfo {
	name: string;
	abbrev: string;
	version: string;
	dependencies: PackageDependency[];
	/** Version requested of the host processor (e.g. eXist-db), if declared. */
	processorVersion?: string;
}

/** Parses an `expath-pkg.xml`: package identity plus its package (not processor) dependencies. */
export function parseExpathPkg(xml: string): PackageInfo {
	const doc = slimdom.parseXmlDocument(xml);
	const root = doc.documentElement;
	if (!root) throw new Error("empty XML document");
	const dependencies: PackageDependency[] = [];
	let processorVersion: string | undefined;
	for (const child of root.children) {
		if (child.namespaceURI !== PKG_NS || child.localName !== "dependency") continue;
		const pkg = child.getAttribute("package");
		if (pkg) {
			dependencies.push({
				name: pkg,
				semverMin: child.getAttribute("semver-min") ?? undefined,
				semverMax: child.getAttribute("semver-max") ?? undefined,
				semver: child.getAttribute("semver") ?? undefined,
			});
		} else if (child.getAttribute("processor")) {
			processorVersion = child.getAttribute("semver-min") ?? child.getAttribute("semver") ?? undefined;
		}
	}
	return {
		name: root.getAttribute("name") ?? "",
		abbrev: root.getAttribute("abbrev") ?? "",
		version: root.getAttribute("version") ?? "",
		dependencies,
		processorVersion,
	};
}

/** Compares dotted versions numerically; `prefixLen` limits the comparison to that many components. */
function compareVersions(a: string, b: string, prefixLen?: number): number {
	const pa = a.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
	const pb = b.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
	const n = prefixLen ?? Math.max(pa.length, pb.length);
	for (let i = 0; i < n; i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d !== 0) return d;
	}
	return 0;
}

const componentCount = (v: string) => v.split(".").length;

/**
 * Whether `version` satisfies a dependency's `semver` / `semver-min` / `semver-max`. Bounds
 * with fewer than three components are prefixes: `semver-max="1"` admits every 1.x.y.
 */
export function satisfies(version: string, dep: PackageDependency): boolean {
	if (dep.semver && compareVersions(version, dep.semver, componentCount(dep.semver)) !== 0) return false;
	if (dep.semverMin && compareVersions(version, dep.semverMin) < 0) return false;
	if (dep.semverMax && compareVersions(version, dep.semverMax, componentCount(dep.semverMax)) > 0) return false;
	return true;
}

export interface RepoVersion {
	version: string;
	/** XAR file name under `<repo>/public/`. */
	path: string;
}

/**
 * Parses the repository's package index (`public/apps.xml`) into a map from package name
 * URI to its available versions. Packages are matched on their name URI, never on abbrev.
 */
export function parseRepoIndex(xml: string): Map<string, RepoVersion[]> {
	const doc = slimdom.parseXmlDocument(xml);
	const out = new Map<string, RepoVersion[]>();
	const text = (el: slimdom.Element, tag: string) =>
		Array.from(el.children).find((c) => c.localName === tag)?.textContent ?? "";
	for (const app of Array.from(doc.documentElement?.children ?? [])) {
		const name = text(app, "name");
		const appPath = app.getAttribute("path");
		if (!name || !appPath) continue;
		const versions: RepoVersion[] = [{ version: text(app, "version"), path: appPath }];
		for (const older of Array.from(app.children).filter((c) => c.localName === "older")) {
			for (const v of Array.from(older.children)) {
				const p = v.getAttribute("path");
				// Older entries carry no <version>; it is the numeric suffix of the file name.
				const m = p?.match(/-(\d+(?:\.\d+)*)(?:-[\w.]+)?\.xar$/);
				if (p && m) versions.push({ version: m[1], path: p });
			}
		}
		out.set(name, [...(out.get(name) ?? []), ...versions]);
	}
	return out;
}

/** The newest version satisfying `dep`, or undefined. */
export function pickVersion(versions: RepoVersion[] | undefined, dep: PackageDependency): RepoVersion | undefined {
	return (versions ?? [])
		.filter((v) => satisfies(v.version, dep))
		.sort((a, b) => compareVersions(b.version, a.version))[0];
}

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

export interface FetchDepsOptions {
	/** Directory the packages are unpacked into. */
	outDir: string;
	repoUrl?: string;
	/** eXist-db version the repository index is filtered for (it hides packages that need a newer one). Default: ${DEFAULT_EXIST_VERSION}. */
	existVersion?: string;
	/** Injectable for tests; defaults to global `fetch`. */
	fetch?: FetchLike;
	log?: (message: string) => void;
}

export interface FetchDepsResult {
	fetched: Array<{ name: string; abbrev: string; version: string }>;
	/** Package names the repository could not resolve, or whose download failed. */
	unresolved: string[];
}

/** Unpacks `files` (path → bytes, from a XAR) into `dir`, refusing entries that escape it. */
function writeEntries(dir: string, files: Record<string, Uint8Array>): void {
	const root = path.resolve(dir);
	for (const [name, data] of Object.entries(files)) {
		if (name.endsWith("/")) continue;
		const target = path.resolve(root, name);
		if (target !== root && !target.startsWith(root + path.sep)) continue; // zip-slip guard
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, data);
	}
}

/**
 * Fetches and unpacks every package `root` depends on, transitively. Each package name is
 * attempted once; already-visited names (including cycles) are skipped.
 */
export async function fetchDeps(root: PackageInfo, options: FetchDepsOptions): Promise<FetchDepsResult> {
	const doFetch: FetchLike = options.fetch ?? ((url) => fetch(url));
	const repoUrl = options.repoUrl ?? DEFAULT_REPO_URL;
	const log = options.log ?? (() => {});
	const result: FetchDepsResult = { fetched: [], unresolved: [] };
	const seen = new Set<string>([root.name]);
	const base = repoUrl.replace(/\/$/, "");
	let index: Map<string, RepoVersion[]> | undefined;

	async function getBytes(url: string): Promise<Uint8Array> {
		const res = await doFetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
		return new Uint8Array(await res.arrayBuffer());
	}

	async function visit(pkg: PackageInfo): Promise<void> {
		for (const dep of pkg.dependencies) {
			if (seen.has(dep.name)) continue;
			seen.add(dep.name);
			let bytes: Uint8Array;
			try {
				index ??= parseRepoIndex(
					new TextDecoder().decode(
						await getBytes(
							`${base}/public/apps.xml?version=${options.existVersion ?? DEFAULT_EXIST_VERSION}`,
						),
					),
				);
				const available = index.get(dep.name);
				const chosen = pickVersion(available, dep);
				if (!chosen) {
					throw new Error(
						available
							? `no version matches (available: ${available.map((v) => v.version).join(", ")})`
							: "not in the repository",
					);
				}
				bytes = await getBytes(`${base}/public/${chosen.path}`);
			} catch (e) {
				log(`warning: could not resolve ${dep.name}: ${(e as Error).message}`);
				result.unresolved.push(dep.name);
				continue;
			}
			let files: Record<string, Uint8Array>;
			try {
				files = unzip(bytes);
			} catch (e) {
				log(`warning: ${dep.name} is not a valid XAR: ${(e as Error).message}`);
				result.unresolved.push(dep.name);
				continue;
			}
			const pkgXml = files["expath-pkg.xml"];
			if (!pkgXml) {
				log(`warning: ${dep.name} has no expath-pkg.xml`);
				result.unresolved.push(dep.name);
				continue;
			}
			const info = parseExpathPkg(new TextDecoder().decode(pkgXml));
			const abbrev = info.abbrev || path.basename(dep.name);
			writeEntries(path.join(options.outDir, abbrev), files);
			log(`fetched ${dep.name} ${info.version} → ${path.join(options.outDir, abbrev)}`);
			result.fetched.push({ name: dep.name, abbrev, version: info.version });
			await visit(info);
		}
	}

	await visit(root);
	return result;
}

const USAGE = `xq-lsp fetch-deps — download the EXPath package dependencies of a project

Usage:
  xq-lsp fetch-deps [options] [expath-pkg.xml]

Reads the <dependency package="…"/> entries of expath-pkg.xml (default: ./expath-pkg.xml,
then ./expath-pkg.xml.tmpl), resolves them from an EXPath package repository, and unpacks
the XARs so 'import module' can be resolved by 'xq-lsp lint' and the language server.

Options:
  -o, --out <dir>   Directory to unpack into (default: ${DEFAULT_DEPS_DIR}, or $XQ_LSP_DEPS_DIR)
      --repo <url>  Package repository (default: ${DEFAULT_REPO_URL}, or $XQ_LSP_REPO_URL)
      --exist-version <v>  eXist-db version to resolve for (default: ${DEFAULT_EXIST_VERSION})
  -h, --help        Show this help

Packages the repository cannot resolve are reported as warnings; they do not fail the run.
Exit codes: 0 done, 2 fatal (bad arguments, unreadable expath-pkg.xml).
`;

/** Runs the fetch-deps subcommand; returns the exit code and never throws. */
export async function runFetchDepsCli(args: string[], fetchImpl?: FetchLike): Promise<number> {
	let out = process.env.XQ_LSP_DEPS_DIR || DEFAULT_DEPS_DIR;
	let repo = process.env.XQ_LSP_REPO_URL || DEFAULT_REPO_URL;
	let existVersion: string | undefined;
	let pkgPath: string | undefined;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-h" || arg === "--help") {
			process.stdout.write(USAGE);
			return 0;
		} else if (arg === "-o" || arg === "--out") {
			const v = args[++i];
			if (!v) return usageError(`Missing value for ${arg}`);
			out = v;
		} else if (arg === "--exist-version") {
			const v = args[++i];
			if (!v) return usageError(`Missing value for ${arg}`);
			existVersion = v;
		} else if (arg === "--repo") {
			const v = args[++i];
			if (!v) return usageError(`Missing value for ${arg}`);
			repo = v;
		} else if (arg.startsWith("-")) {
			return usageError(`Unknown option "${arg}"`);
		} else {
			pkgPath = arg;
		}
	}
	pkgPath ??= ["expath-pkg.xml", "expath-pkg.xml.tmpl"].find((f) => fs.existsSync(f));
	if (!pkgPath) return usageError("No expath-pkg.xml found in the current directory");

	let info: PackageInfo;
	try {
		info = parseExpathPkg(fs.readFileSync(pkgPath, "utf-8"));
	} catch (e) {
		console.error(`xq-lsp fetch-deps: error: Cannot read "${pkgPath}": ${(e as Error).message}`);
		return 2;
	}
	const result = await fetchDeps(info, {
		outDir: path.resolve(out),
		repoUrl: repo,
		existVersion,
		fetch: fetchImpl,
		log: (m) => console.error(m),
	});
	console.error(`${result.fetched.length} package(s) fetched, ${result.unresolved.length} unresolved.`);
	return 0;
}

function usageError(message: string): number {
	console.error(`xq-lsp fetch-deps: error: ${message}`);
	console.error("Run 'xq-lsp fetch-deps --help' for usage.");
	return 2;
}
