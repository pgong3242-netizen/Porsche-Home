import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { readRsrBytes } from "./rsr-assembly";
import { disposeSceneObject } from "./scene-loading";
import type { DisplayCar } from "./import-car";
import type { WorkshopExhibit } from "./workshop-catalog";

/**
 * 911 GT3 RS 车模（blenderbett / CC BY 4.0，Sketchfab 层级模型，282 个网格）。
 *
 * 两条路径共用同一套归一化 + 材质处理：
 *  - `loadGt3Rs()`        车库展车：守卫者红车身，尺寸与主角车同口径。
 *  - `loadGt3RsDisplay()` 庭院 / 欢迎镜头的主角车：车身颜色与轮圈饰面跟随车库配置面板。
 *
 * 车身面板是平色材质 `BODYY`（无贴图，13 个网格：翼子板 / 车门 / 前盖 / 保险杠 / 后视镜 / 尾翼），
 * 所以直接换成同一族的新材质即可换色，车漆光泽（金属度 0 / 粗糙度 0 / 清漆 0.4）保持原样。
 * 轮圈「饰面」作用于 `spoke` / `material` / `lugs`（轮辐 / 轮辋 / 螺栓，带贴图，颜色做乘法）。
 *
 * 之前的展车会挂 `createPartModules()` 的盲盒幽灵零件（灰色半透明低模）显示收藏进度，但 GT3 车身是
 * 封闭外壳，变速箱盒浮在车顶后方、刹车盘伸出轮外，用户判定为「白色零件」要求去掉 ——「保留车就好」。
 * 因此两条路径都不再生成任何幽灵零件。
 */
const GT3_RS_URL = "./models/porsche-911-gt3-rs.glb.gz";
const EXHIBIT_COLOR = "#c91f2f";
const LENGTH = 4.75;                                    // 与 Carrera 主角车同口径的车长（米）
const BODY = /^BODYY$/;                                 // 车身面板
const RIMS = new Set(["spoke", "material", "lugs"]);    // 轮辐 / 轮辋 / 螺栓

// The GT3 RS is the workshop's default exhibit but ships ~14 MB gzipped; the garden
// starts this download early (GardenScene workshop prewarm) so the bytes are ready
// before the workshop opens. Decompressed bytes are cached for the session.
let bytesPromise: Promise<ArrayBuffer> | undefined;

export function prefetchGt3Rs(): Promise<ArrayBuffer> {
  bytesPromise ??= fetch(GT3_RS_URL).then(readRsrBytes).catch(error => { bytesPromise = undefined; throw error; });
  return bytesPromise;
}

type Gt3RsModel = { group: THREE.Group; paint: THREE.MeshPhysicalMaterial; rims: THREE.MeshStandardMaterial[] };

async function buildGt3Rs(color: string, shadows: boolean, signal?: AbortSignal): Promise<Gt3RsModel> {
  const bytes = await prefetchGt3Rs();
  signal?.throwIfAborted();
  const { scene: model } = await new GLTFLoader().parseAsync(bytes, "");
  if (signal?.aborted) { disposeSceneObject(model); signal.throwIfAborted(); }
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  model.scale.setScalar(LENGTH / Math.max(size.x, size.z));
  bounds.setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .6, roughness: .24, clearcoat: .4, clearcoatRoughness: .03, side: THREE.DoubleSide });
  let bodyCopied = false;
  const rims: THREE.MeshStandardMaterial[] = [];
  model.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    if (shadows) { node.castShadow = true; node.receiveShadow = true; }
    const single = !Array.isArray(node.material);
    const list: THREE.Material[] = single ? [node.material as THREE.Material] : node.material;
    const materials = list.map((material: THREE.Material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return material;
      if (BODY.test(material.name)) {
        // Same paint family as the source panel: only the colour is ours to drive.
        if (!bodyCopied) { paint.copy(material); bodyCopied = true; }
        return paint;
      }
      if (RIMS.has(material.name) && !rims.includes(material)) rims.push(material);
      return material;
    });
    node.material = single ? materials[0] : materials;
  });
  paint.color.set(color);
  const group = new THREE.Group();
  group.add(model);
  return { group, paint, rims };
}

function tintRims(rims: readonly THREE.MeshStandardMaterial[], wheels: 'silver' | 'black') {
  const color = wheels === 'black' ? '#353a36' : '#c0c5c3';
  for (const rim of rims) rim.color.set(color);
}

/** 车库展车：保持守卫者红，不挂幽灵零件。 */
export async function loadGt3Rs(signal?: AbortSignal): Promise<WorkshopExhibit> {
  const { group } = await buildGt3Rs(EXHIBIT_COLOR, false, signal);
  return { group, parts: [] };
}

/** 庭院 / 欢迎镜头主角车：契约与 `loadDisplayCar()` 一致，可换车色与轮圈饰面。 */
export async function loadGt3RsDisplay(color: string, signal?: AbortSignal): Promise<DisplayCar> {
  const { group, paint, rims } = await buildGt3Rs(color, true, signal);
  tintRims(rims, 'silver');
  return { group, parts: [], paint, rims };
}
