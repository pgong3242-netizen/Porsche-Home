import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

test("bundled GT3 RS is a complete self-contained glTF with original attribution", () => {
  const bytes = gunzipSync(readFileSync(new URL("../public/models/porsche-911-gt3-rs.glb.gz", import.meta.url)));
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
  assert.equal(gltf.asset.extras.title, "PORSHE GT3 RS");
  assert.match(gltf.asset.extras.license, /CC-BY-4.0/);
  assert.ok(gltf.meshes.length > 0);
  assert.ok(gltf.buffers.every(buffer => !buffer.uri));
  assert.ok(gltf.images.every(image => image.bufferView !== undefined));
});
