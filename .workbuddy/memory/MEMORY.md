# 类土豆兄弟 — 项目长期记忆

## 定位
单文件 3D 幸存者射击，three.js r160 UMD CDN，`file://` 双击即玩。8 分片(p1~p8)经 `tools/build.mjs` 拼 `index.html`。交付文档 `类土豆兄弟_源码与策划书.md`（5 部分：策划书/源码/工具链/第三方评审/核查落地）。

## 硬约束 / 坑
- ⚠️ `Game.start` 顺序：`Player.setShip`+`Player.reset` 必须在 `Progress.reset` **之前**，否则 cfg 漂一格。
- ⚠️ 新增 `HUD.xxxBanner` 类函数时，`p1_shell.html` 必须同步插 `<div id="xxx">`，否则 `id()` 返回 null 卡死开局。
- ⚠️ puppeteer 无头环境损坏（`BrowserLauncher.js:74` 抛 includes），无法运行时验证/截图。兜底：全分片 `node --check` + 人工双击；纯逻辑用 `tools/test_*.mjs`（vm 加载分片断言）。
- file:// 下**禁** ESM+GLTFLoader+纹理（CORS 死）。模型走离线烘焙 `assets/meshes.js`(17 key，Int16 量化 base64)，`Gfx.*` 还原。

## 渲染架构（InstancedMesh 化，勿回退成逐实例 Mesh）
敌/弹/水晶走 `InstancedMesh`+纯数据池，逐帧 `_flush()` 重写矩阵；陨石/BOSS/玩家/僚机仍独立 Mesh。
- 敌人：`Enemies._insts[variant]`(按 SPEC.variants 建 10+__default，各 cap 300) + `_outline[variant]`(BackSide 1.06× 描边壳，renderOrder=-1)；几何 `Gfx.enemyBodyGeo(vk)` 合并 body 部件（去描边壳/尾焰）；受击闪白/精英/星域染色走 `instanceColor`；`_curTint` 由 director 写。`Gfx.enemyShip` 已无调用方(死代码)。
- 子弹：`Bullets.pInst`(420)/`eInst`(300) + `_flush`；导弹保留 Mesh 池(独立朝向+尾焰)。
- 水晶：`Loot.inst`(Octahedron,400)。
- 缺失 key：`Gfx._mkMissingProxy` 洋红自转占位 + `console.warn` 一次。

## 本期内容扩展（A/B/H/C①/C② 已落地，2026-08-13）
- 难度曲线：`Game.hpMulAt(w)` = `1+0.063·w^1.8` + 后期 exp 阻尼(上限900) + endless×1.35；`spdMul` 无尽放开 2.2、`elite`≤0.25、`w>15` 注相位/炮塔/狙击编队；BOSS 血接同曲线；`waveSpec` 按波缓存。`Game.start` 清 `this._wsCache={}`。
- 标签共鸣：新增 `Synergy` 模块（p7_boss.js），六标签(heavy/precise/energy/ballistic/summon/medical)×3/6/9/12 阶梯；24 武器挂 `tags`；乘算集中在 6 choke point(敌/Boss 伤害、玩家 heal/speed/armor、暴击率/暴伤)；`Progress.reset/applyCard` 自动 `Synergy.refresh()`；选卡显示标签进度、装备栏底部流派阶梯条。其余 mods(控制/元素/弹速/射速/穿透/召唤/受击回血) 预留未接线。
- 主题星际化：`W_INFO` 5 武器改名(轨道切割环/等离子电弧/量子飞轮/等离子灼焰/重力脉冲，内部 key 不动)；`Enemies.SPEC` 加三派系注释(残骸掠夺者/虚空母巢/深渊军团)。
- C① 新武器 4 把（复用现有系统，无新实体系统）：`frost`(energy,命中叠霜、冻结期受伤×1.5、霜蓝lerp；p4 加 frost 字段+p6 加 frostLv/frostT/`_flush` 霜色)、`meteor`(heavy,锁定密集区、Asteroids.geos 残骸坠落Mesh+Enemies.splash AoE、自管 `Weapons.meteors[]`)、`swarm`(barrage,复用导弹池 scale0.5 + pickTargets 齐射)、`storm`(energy,复用 `_chainBeam` 天空雷击随机抽敌+Enemies.damage)。均进 `W_INFO`→自动进三选一；Audio2 加 frostZap/meteorWarn/meteorFall/stormCrack。各 5 级。
- C② 新武器 7 把（全新实体系统）：`blackhole`(energy,引力井吸附+静默DOT+坍缩爆发;`Weapons.blackholes[]`+Group 几何)、`phase`(medical,周期相位护盾;`Player.phaseHp/phaseMesh` 先于护甲承伤)、`photon`(precise,命中弹射至最近其他敌、限 bounce 次;`Weapons.photons[]`)、`tractor`(heavy,常驻引力场聚敌+减速+DOT;`tractorMesh`)、`rotor`(barrage,环绕相位节点接触杀伤;`rotorNodes[]` 最多6)、`mine`(barrage,周围布雷敌近即爆;`minePool` 28 槽)、`nano`(medical,周期治疗;`Player.heal`)。各 5 级；`Enemies.damage` 增 `fx` 静默参支持 DOT；`W_INFO` 加 7 条+`tags`；Audio2 加 7 音效;`Progress.describe` 加 7 分支。

## 交付同步
改完代码跑 **`python tools/sync_doc.py`** 重建文档第二部分(8 分片)+第三部分(build.mjs/bake_models.mjs)，手写文字原样保留、幂等。手写章节(§4.3/§6/§7/§5.6/§5.7)需人工同步。

## 关键文件
`index.html` | `build/`(p1~p8) | `assets/meshes.js`(17 key) | `tools/`(build/sync_doc/test_synergy) | `类土豆兄弟_源码与策划书.md` | 备份 `build_bak_*/index_bak_*.html`

## 下一步（待用户拍板）
C 全部 11 把新武器已落地（C① 4 复用 + C② 7 实体）。→ B 武器槽 4→6+swap UI（C 已铺满，可做了）→ D 敌人+变异 → E 僚机索敌 → F 玩家行为 → G 场景危害 → I 美化。验证链路重建（puppeteer 仍坏，test_synergy 仅覆盖纯数学/共鸣/标签）。
