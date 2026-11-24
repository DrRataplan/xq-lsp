import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";
import * as os from "node:os";
import { fetchDeps, parseExpathPkg, parseRepoIndex, pickVersion, satisfies, type FetchLike } from "./fetch-deps.ts";
import { lintTargets } from "./lint.ts";
import { unzip } from "./zip.ts";

async function withTmpDir(fn: (dir: string) => Promise<void> | void): Promise<void> {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xq-lsp-test-"));
	try {
		await fn(dir);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

const strToU8 = (s: string) => new Uint8Array(Buffer.from(s));

/** Test-only zip writer: deflate (or stored when `store`) entries plus a central directory. */
function zipSync(files: Record<string, Uint8Array>, store = false): Uint8Array {
	const parts: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const [name, data] of Object.entries(files)) {
		const raw = Buffer.from(data);
		const comp = store ? raw : deflateRawSync(raw);
		const method = store ? 0 : 8;
		const nameBuf = Buffer.from(name);
		const crc = crc32(raw);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(method, 8);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(comp.length, 18);
		local.writeUInt32LE(raw.length, 22);
		local.writeUInt16LE(nameBuf.length, 26);
		parts.push(local, nameBuf, comp);
		const cen = Buffer.alloc(46);
		cen.writeUInt32LE(0x02014b50, 0);
		cen.writeUInt16LE(20, 4);
		cen.writeUInt16LE(20, 6);
		cen.writeUInt16LE(method, 10);
		cen.writeUInt32LE(crc, 16);
		cen.writeUInt32LE(comp.length, 20);
		cen.writeUInt32LE(raw.length, 24);
		cen.writeUInt16LE(nameBuf.length, 28);
		cen.writeUInt32LE(offset, 42);
		central.push(cen, nameBuf);
		offset += local.length + nameBuf.length + comp.length;
	}
	const cenBuf = Buffer.concat(central);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(Object.keys(files).length, 8);
	eocd.writeUInt16LE(Object.keys(files).length, 10);
	eocd.writeUInt32LE(cenBuf.length, 12);
	eocd.writeUInt32LE(offset, 16);
	return new Uint8Array(Buffer.concat([...parts, cenBuf, eocd]));
}

const pkgXml = (name: string, abbrev: string, deps = "") =>
	`<package xmlns="http://expath.org/ns/pkg" name="${name}" abbrev="${abbrev}" version="1.0.0" spec="1.0">
	<title>t</title><dependency processor="http://exist-db.org" semver-min="5.3.0"/>${deps}</package>`;

function xar(name: string, abbrev: string, files: Record<string, string>, deps = ""): Uint8Array {
	const entries: Record<string, Uint8Array> = { "expath-pkg.xml": strToU8(pkgXml(name, abbrev, deps)) };
	for (const [k, v] of Object.entries(files)) entries[k] = strToU8(v);
	return zipSync(entries);
}

function fakeRepo(packages: Record<string, Uint8Array>): { fetch: FetchLike; urls: string[] } {
	const urls: string[] = [];
	const index = `<apps>${Object.keys(packages)
		.map((n, i) => `<app path="p${i}-1.0.0.xar"><name>${n}</name><version>1.0.0</version></app>`)
		.join("")}</apps>`;
	const paths = new Map(Object.keys(packages).map((n, i) => [`p${i}-1.0.0.xar`, packages[n]]));
	const ok = (bytes: Uint8Array) => ({
		ok: true,
		status: 200,
		arrayBuffer: async () =>
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	});
	const fetch: FetchLike = async (url) => {
		urls.push(url);
		const u = new URL(url);
		if (u.pathname.endsWith("/public/apps.xml")) return ok(strToU8(index));
		const bytes = paths.get(u.pathname.split("/").pop() ?? "");
		return bytes ? ok(bytes) : { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
	};
	return { fetch, urls };
}

const LIB = `xquery version "3.1";\nmodule namespace l = "http://example.com/lib";\ndeclare function l:f($x as xs:string) as xs:string { $x };\n`;

describe("unzip", () => {
	for (const store of [false, true]) {
		test(`reads ${store ? "stored" : "deflated"} entries`, () => {
			const files = unzip(zipSync({ "a/b.txt": strToU8("hello ".repeat(50)), "c.txt": strToU8("x") }, store));
			assert.equal(Buffer.from(files["a/b.txt"]).toString(), "hello ".repeat(50));
			assert.equal(Buffer.from(files["c.txt"]).toString(), "x");
		});
	}
	test("rejects non-zip input", () => {
		assert.throws(() => unzip(strToU8("not a zip at all, definitely not")), /not a zip/);
	});
});

describe("parseExpathPkg", () => {
	test("reads identity, package deps and processor version", () => {
		const info = parseExpathPkg(
			pkgXml("urn:a", "a", `<dependency package="urn:b" semver-min="1.2.0"/><dependency package="urn:c"/>`),
		);
		assert.equal(info.name, "urn:a");
		assert.equal(info.abbrev, "a");
		assert.equal(info.processorVersion, "5.3.0");
		assert.deepEqual(
			info.dependencies.map((d) => [d.name, d.semverMin]),
			[
				["urn:b", "1.2.0"],
				["urn:c", undefined],
			],
		);
	});
});

describe("version resolution", () => {
	const dep = (o: object) => ({ name: "urn:x", ...o });
	test("satisfies honours min, max and prefix bounds", () => {
		assert.ok(satisfies("2.0.2", dep({ semverMin: "1.1.2" })));
		assert.ok(!satisfies("1.1.1", dep({ semverMin: "1.1.2" })));
		assert.ok(satisfies("1.9.0", dep({ semverMax: "1" })));
		assert.ok(!satisfies("2.0.0", dep({ semverMax: "1" })));
		assert.ok(satisfies("10.0.0", dep({ semverMin: "9.9.9" })));
	});

	test("parseRepoIndex keys on the package name URI and reads older versions from file names", () => {
		const index = parseRepoIndex(`<apps>
			<app path="jwt-2.0.2.xar"><name>http://existsolutions.com/ns/jwt</name><abbrev>jwt</abbrev><version>2.0.2</version>
				<older><version path="jwt-1.1.2.xar"/><version path="jwt-1.0.1.xar"/></older></app></apps>`);
		const versions = index.get("http://existsolutions.com/ns/jwt")!;
		assert.deepEqual(
			versions.map((v) => v.version),
			["2.0.2", "1.1.2", "1.0.1"],
		);
		assert.equal(index.get("jwt"), undefined); // abbrev is never a key
		assert.equal(pickVersion(versions, dep({ semverMax: "1" }))?.path, "jwt-1.1.2.xar");
		assert.equal(pickVersion(versions, dep({ semverMin: "3.0.0" })), undefined);
	});
});

describe("fetchDeps", () => {
	test("unpacks packages transitively and reports unresolved ones", async () => {
		await withTmpDir(async (dir) => {
			const repo = fakeRepo({
				"http://example.com/lib": xar(
					"http://example.com/lib",
					"lib",
					{ "content/lib.xqm": LIB },
					`<dependency package="urn:deeper"/>`,
				),
				"urn:deeper": xar("urn:deeper", "deeper", { "content/d.xqm": LIB }),
			});
			const root = parseExpathPkg(
				pkgXml(
					"urn:root",
					"root",
					`<dependency package="http://example.com/lib"/><dependency package="urn:missing"/>`,
				),
			);
			const result = await fetchDeps(root, { outDir: path.join(dir, "deps"), fetch: repo.fetch });
			assert.deepEqual(
				result.fetched.map((f) => f.abbrev),
				["lib", "deeper"],
			);
			assert.deepEqual(result.unresolved, ["urn:missing"]);
			assert.ok(fs.existsSync(path.join(dir, "deps/lib/content/lib.xqm")));
			assert.ok(fs.existsSync(path.join(dir, "deps/deeper/content/d.xqm")));
		});
	});

	test("does not loop on dependency cycles", async () => {
		await withTmpDir(async (dir) => {
			const repo = fakeRepo({
				"urn:a": xar("urn:a", "a", {}, `<dependency package="urn:b"/>`),
				"urn:b": xar("urn:b", "b", {}, `<dependency package="urn:a"/>`),
			});
			const result = await fetchDeps(parseExpathPkg(pkgXml("urn:root", "r", `<dependency package="urn:a"/>`)), {
				outDir: dir,
				fetch: repo.fetch,
			});
			assert.equal(result.fetched.length, 2);
			assert.equal(repo.urls.length, 3); // index + 2 XARs
		});
	});

	test("ignores archive entries that escape the output directory", async () => {
		await withTmpDir(async (dir) => {
			const evil = zipSync({
				"expath-pkg.xml": strToU8(pkgXml("urn:evil", "evil")),
				"../../escaped.txt": strToU8("x"),
			});
			const repo = fakeRepo({ "urn:evil": evil });
			await fetchDeps(parseExpathPkg(pkgXml("urn:r", "r", `<dependency package="urn:evil"/>`)), {
				outDir: path.join(dir, "deps"),
				fetch: repo.fetch,
			});
			assert.ok(!fs.existsSync(path.join(dir, "escaped.txt")));
			assert.ok(!fs.existsSync(path.join(dir, "deps/escaped.txt")));
		});
	});
});

describe("lint resolves fetched dependencies", () => {
	const importer = `import module namespace l = "http://example.com/lib";\nl:f("x")\n`;

	test("default .xq-deps directory next to the config", async () => {
		await withTmpDir(async (dir) => {
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "glob": "src/*.xq" }\n`);
			fs.mkdirSync(path.join(dir, "src"));
			fs.writeFileSync(path.join(dir, "src/main.xq"), importer);
			const before = lintTargets(["src"], { cwd: dir });
			assert.ok(before.results[0].messages.some((m) => m.code === "xq-lsp:unresolved-import"));

			fs.mkdirSync(path.join(dir, ".xq-deps/lib/content"), { recursive: true });
			fs.writeFileSync(path.join(dir, ".xq-deps/lib/content/lib.xqm"), LIB);
			const after = lintTargets(["src"], { cwd: dir });
			assert.ok(!after.results[0].messages.some((m) => m.code === "xq-lsp:unresolved-import"));
		});
	});

	test("explicit depsDir overrides the default", async () => {
		await withTmpDir(async (dir) => {
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "glob": "src/*.xq" }\n`);
			fs.mkdirSync(path.join(dir, "src"));
			fs.writeFileSync(path.join(dir, "src/main.xq"), importer);
			fs.mkdirSync(path.join(dir, "elsewhere/lib/content"), { recursive: true });
			fs.writeFileSync(path.join(dir, "elsewhere/lib/content/lib.xqm"), LIB);
			const out = lintTargets(["src"], { cwd: dir, depsDir: path.join(dir, "elsewhere") });
			assert.ok(!out.results[0].messages.some((m) => m.code === "xq-lsp:unresolved-import"));
		});
	});

	test("a project module wins over a fetched dependency with the same namespace", async () => {
		await withTmpDir(async (dir) => {
			fs.writeFileSync(path.join(dir, "lsp-config.xq"), `map { "glob": "src/*.xq*" }\n`);
			fs.mkdirSync(path.join(dir, "src"));
			fs.writeFileSync(path.join(dir, "src/lib.xqm"), LIB);
			fs.writeFileSync(path.join(dir, "src/main.xq"), importer);
			fs.mkdirSync(path.join(dir, ".xq-deps/lib/content"), { recursive: true });
			fs.writeFileSync(path.join(dir, ".xq-deps/lib/content/lib.xqm"), LIB);
			const out = lintTargets(["src"], { cwd: dir });
			const all = out.results.flatMap((r) => r.messages.map((m) => m.code));
			assert.ok(!all.includes("XQST0034"), all.join(","));
		});
	});
});
