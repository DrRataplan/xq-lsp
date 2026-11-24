/**
 * Minimal zip reader (stored + deflate entries) on top of node:zlib, so XAR packages
 * can be unpacked without a dependency. Reads the central directory, so archives with
 * data descriptors work. No zip64, encryption, or multi-disk support.
 */
import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export function unzip(buf: Uint8Array): Record<string, Uint8Array> {
	const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
	let eocd = -1;
	for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
		if (b.readUInt32LE(i) === EOCD_SIG) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new Error("not a zip archive");
	const count = b.readUInt16LE(eocd + 10);
	let pos = b.readUInt32LE(eocd + 16);
	const out: Record<string, Uint8Array> = {};
	for (let n = 0; n < count; n++) {
		if (b.readUInt32LE(pos) !== CEN_SIG) throw new Error("corrupt zip central directory");
		const method = b.readUInt16LE(pos + 10);
		const compSize = b.readUInt32LE(pos + 20);
		const nameLen = b.readUInt16LE(pos + 28);
		const extraLen = b.readUInt16LE(pos + 30);
		const commentLen = b.readUInt16LE(pos + 32);
		const localOffset = b.readUInt32LE(pos + 42);
		const name = b.toString("utf8", pos + 46, pos + 46 + nameLen);
		pos += 46 + nameLen + extraLen + commentLen;

		if (b.readUInt32LE(localOffset) !== LOC_SIG) throw new Error(`corrupt zip entry "${name}"`);
		const dataStart = localOffset + 30 + b.readUInt16LE(localOffset + 26) + b.readUInt16LE(localOffset + 28);
		const data = b.subarray(dataStart, dataStart + compSize);
		if (method === 0) out[name] = new Uint8Array(data);
		else if (method === 8) out[name] = new Uint8Array(inflateRawSync(data));
		else throw new Error(`unsupported zip compression method ${method} for "${name}"`);
	}
	return out;
}
