# Scene loading and performance

The main 3D view shares one renderer. The workshop shell starts independently;
the landscape is constructed on its first visit and retained for return visits.
Only the selected architecture, plants and campus are built. New configuration
variants are created when selected. The complete Carrera loads after the basic
scene is usable; a direct RSR visit does not also download Carrera.

The compressed RSR asset is served as `42096-rsr.bin`: the production server
reserves `.gz` files for HTTP compression variants and does not expose them directly.
The loader detects gzip bytes instead of assuming fetch has not decoded them.

RSR metadata is lightweight. Its loader and the Carrera mechanical assembly use
dynamic imports. RSR downloads are aborted on scene unmount. Compilation must
settle before renderer/material disposal because Three.js polls shader programs
inside `compileAsync()`.

Construction yields between stages. Carrera geometry conversion yields between
meshes. Static opaque sibling meshes are merged without crossing parent groups,
so doors can still move and building variants can still switch independently.
Vehicle parts and the card/collection implementation are not batched or changed.
Unchanged RSR assembly progress is not recalculated every frame. Static garage
frames stop drawing once transitions settle; interaction invalidates the view.

## Checked structural baseline

Using the same Alpine/pine/day configuration, before the imported Carrera resolves:

| Measure | Before | After |
| --- | ---: | ---: |
| Constructed home meshes (including hidden objects) | 2507 | 475 |
| Distinct RSR material configurations referenced by primitives | 386 separate entries | 13 shared entries |

These counts are not measured FPS or draw-call improvements. The browser available
in this environment uses software rendering and does not support parallel shader
compilation; its wall-clock timings are not a hardware GPU benchmark.

## Regression checks

```sh
node tests/garden-startup.test.mjs
node_modules/.bin/tsx --test tests/scene-performance.test.ts tests/design.test.ts
node --test tests/friends-map.test.mjs tests/private-garage.test.mjs tests/research-parking.test.mjs
node_modules/.bin/tsc --noEmit
npm run build
```

In a production browser, verify cold direct workshop entry, cold direct RSR entry,
first workshop-to-home navigation, repeated home/workshop/model switches, and
leaving while compilation/downloads are pending. Check that RSR is fetched once
per mounted scene and that no Carrera download occurs on a direct RSR visit.
Repeat on a hardware GPU with a Performance recording before claiming a frame-time
improvement. Large-model parsing and first GPU buffer uploads can still cause
long tasks; shader compilation and texture preparation alone cannot eliminate them.

## 第二轮审计（2026-11-11）：主角车换成 GT3 RS 之后的回退

用户反馈「主页突然很卡」。方法：在 `components/GardenScene.tsx` 的 `controls` 创建之后临时挂
`window.__perf = {renderer, scene, camera, controls}`，用 headless 浏览器 + 审计脚本读计数，
测完立即还原（`git diff` 回到原样）。**帧时间不采信**：此环境是 SwiftShader 软件光栅，一帧秒级，
`requestAnimationFrame` 采样不推进（一次 rAF-wait 直接 30 s 超时）。

实测（`/` 园区 entry 视图，1280×581，dpr=1，读取最后一帧 `renderer.info`）：

| 指标 | 主角车未加载 | GT3 RS 主角车加载后 |
| --- | ---: | ---: |
| draw call / 帧 | 904 | 1823 |
| 三角面 / 帧 | 271,892 | 2,179,433 |
| mesh | 473 | 755 |
| shadow caster | 434 (92%) | 716 (95%) |
| programs | 14 | 38 |
| JS 堆 | — | 117 MB |

`renderer.info.render.calls` 含阴影 pass，因此 1823 里约一半是「场景被重画一遍」。

归因（按收益排序）：

1. **主角车换成 GT3 RS 是唯一的量级跳变。** `public/models/porsche-911-gt3-rs.glb`
   24,701,276 B（gz 14.2 MB）、648 节点 / 282 prim / 575,850 三角面 / 94 材质 / 19 张 PNG
   （`glb_material_probe.py` 实测）。单它一项 +919 call（含阴影）、+1.9M 三角面/帧、+24 programs，
   parse 在主线程同步执行（约 1–2 s 完全停顿）、+约 25 MB 堆。入口：`GardenScene.tsx:547 loadMainCar`
   → `lib/gt3-rs.ts:90 loadGt3RsDisplay`（`buildGt3Rs(..., true)`）。
2. **阴影 pass 半帧。** `mesh()` 默认 `castShadow=true`（`GardenScene.tsx:90`）、
   `lib/world-details.ts:9 add()`、`lib/car-geometry.ts:44` 同样；`sunlight` 用 `mapSize 2048` +
   ortho ±50（覆盖 100×100 单位）、`shadowMap.autoUpdate` 未冻结（`GardenScene.tsx:80`）。
   716/755 个 mesh 都在 caster 名单里。
3. **车模 282 个 mesh 同时开 castShadow + receiveShadow**（`lib/gt3-rs.ts:57`）。
4. **3 个 `KHR_materials_transmission` 材质**（`headlight_1.003` / `glass.004` / `glass_int.001`）
   → three.js 每帧额外渲染一遍场景到 transmission buffer（材质数据确凿；运行时增量本轮未单独测）。
   另有 `clearcoat` / `specular` 扩展变体。
5. **10 个 PointLight**（`glow()`，`GardenScene.tsx:104`；调用点 111/250/272/318/353/392）
   → 前向渲染每 fragment 循环 10 次，且改灯数触发全材质重编译。
6. **pixelRatio 上限 1.8**（`GardenScene.tsx:59`）= fill rate 3.24×，叠加 PCF 阴影 + ACES。
7. **零几何复用**：473 geometry / 473 mesh（reuse 1.0），其中车模贡献 282 个。
8. **同一 GLB 会被 parse 两次**：园区 idle 预热（`prewarmWorkshop`，`:514`）走展车路径
   `loadGt3Rs`（`lib/gt3-rs.ts:84`），与主角车各解析一份 → 第二次 +25 MB 堆 + 一次 1–2 s 停顿。
   弱设备被 `frameCostEma > 33` 门槛挡掉；流畅设备上它会跑。`prefetchGt3Rs()` 只缓存字节，
   不缓存解析结果。

分级方案：

- **A1 阴影收敛**：装饰件（花/铺装/栏杆/树冠/草地/道具）`castShadow=false`，只留地面+建筑主体+车+鸡；
  `mapSize 2048→1024`；ortho ±50→±30。预计 caster 716→约 90，calls 1823→约 950。
- **A2 阴影冻结**：鸡与宠物不投影后 `shadowMap.autoUpdate=false`，仅在光照/物体变化时
  `needsUpdate=true`（相机拖动不再重算阴影）。
- **A3 pixelRatio** 1.8→1.25。
- **A4 点光** 10→3（车棚/工坊/亭子），其余改 emissive 近似。**唯一有视觉损失的项**，夜景会略暗。
- **B1 GT3 解析共享**：`lib/gt3-rs.ts` 增加解析结果缓存，主角车与展车共用一份 model
  （结构 clone、材质共享、只对车身材质换色）→ 省一次 24.7 MB parse 与 ~25 MB 堆。
- **B2 园区只预取字节不 parse 展车**；代价：第一次进车库多等 1–2 s。
- **B3 主角车换回轻量车**（GT3 只用于欢迎镜头/车库）→ 直接砍 +919 calls / +1.9M 三角面。
  与产品意图冲突（用户 2026-11-11 明确要求 GT3 当主角车），只列不改。
- **C1** meshopt 压 24.7 MB → 5~7 MB；**C2** 19 张 PNG 4.07 MB → WebP/KTX2 ~0.7 MB；
  **C3** 去掉 3 个 transmission 材质（省每帧一整个 scene pass，玻璃质感略变）；
  **C4** 车模减面（仅 `spoke` 四只轮子就 232,288 三角面）。C 层需离线 build 脚本 + 保留原文件回滚。

推荐默认：A1+A2+A3+B1（纯代码、零视觉损失），A4 与 C 层单独拍板。**本轮只审计、未改任何代码。**
