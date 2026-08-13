# 第五部分 · 报告论断核查与落地优先级路线图

> 本章由工程侧对第四部分报告做**逐条事实核查**（对照 `build/` 分片真实代码），并给出**按风险/收益/工作量排序**的实施路线图，供落地决策。
> 核查基准：`build/` 当前分片（索引版 203 KB，5 星域 / 13 武器 / 11 战机）。部分结论引用 `build/_index_old_backup.html`（120 KB 旧备份）。

## 5.1 逐条论断核查表

| # | 报告论断 | 代码实情（已核验） | 判定 | 备注 |
| --- | --- | --- | --- | --- |
| 1 | 敌人是独立 `THREE.Mesh`/`Group`，每敌多次 Draw Call | `Enemies._mkMesh` 每次 `spawn` 调 `Gfx.enemyShip(...)` 建独立 Group（p6_enemies.js:36-50），`e.mesh` 持引用 | ✅ 准确 | 这是第一章改造的主目标 |
| 2 | `FX.dmgText` 基于 DOM `<div>` | `document.createElement('div')` + `dmgLayer.appendChild`（p3_world.js:568-580），上限 26 节点 | ✅ 准确 | 已有上限保护，激战仍会抖动 |
| 3 | 难度公式 `hpMul=(1+(w-1)*0.44)*g` 为纯线性 | 逐字存在于 p8_game.js:455 | ✅ 准确 | 第四章 4.3 建议改混合曲线 |
| 4 | `nextBossRound()` 预留但无尽循环未调用 | 仅 `reset()` 与 `nextBossRound` 内 `bossSpawned=false`；`nextBossRound` 全代码零次调用（p8:578/580） | ✅ 准确 | 无尽 BOSS 链断裂，第五章已给修复 |
| 5 | `Grid` 为粗略框架、用动态 `Map` | `const Grid` 在 p2_core.js:649（非独立文件）；实现未深查，但确为空间划分 | ✅ 基本准确 | 报告称"Grid.js"命名略宽松 |
| 6 | 未禁用 `matrixAutoUpdate` | 当前 `build/` 无 `matrixAutoUpdate=false` | ✅ 准确 | 旧备份(p1)有该优化，现版已回退 |
| 7 | 子弹/经验水晶可 InstancedMesh 化 | **旧备份已实例**（p1 旧 `Bullets.pInst/eInst`、`Loot.inst` 均为 InstancedMesh + `matrixAutoUpdate=false`），现版回退为独立 Mesh | ⚠️ 现版未做，但备份可 harvest | 高价值低风险，优先复用 |
| 8 | 八面体法线压缩可再减 33-50% | `meshes.js` 法线为 Int8 量化；改八面体需重烘焙 + 运行时解码 | ✅ 理论成立 | 收益在传输/带宽，运行期几乎无感；优先级低 |
| 9 | 武器缺深度 BD / 标签共鸣 | 当前武器升级孤立单线，无 Tag/Synergy | ✅ 准确 | 第四章内容设计，工作量最大 |
| 10 | 缺失网格静默空壳 | `Gfx.parts` 取不到 key 返回空 Group（无 warn） | ✅ 准确 | 重锤即此例，已修但无预警 |

## 5.2 关键发现：现版相对备份"退化"

`build/_index_old_backup.html` 是一份**更早但渲染更先进**的版本：
- 子弹（玩家/敌方）用 `InstancedMesh`（`pInst`/`eInst`，`CFG.POOL.pbullet`/`ebullet` 容量）
- 经验水晶用 `InstancedMesh`（`Loot.inst`，`CFG.POOL.gem`）
- `g.matrixAutoUpdate = false`，手动写矩阵
- 已有"纯数据池（不含 mesh，渲染交给 InstancedMesh 统一写矩阵）"的架构雏形

**结论**：当前"功能扩展版"为加 5 星域/13 武器/11 战机，把子弹/宝石渲染**回退成了独立 Mesh**。因此第一章关于"子弹/宝石 InstancedMesh 化"并非从零起步——**备份里有一段可直接 harvest 的实例化实现**，能省去大量重写与试错。敌人因是多部件 Group（body+描边+座舱+尾焰），实例化需先合并为单几何体（见 5.3 风险项）。

## 5.3 落地优先级路线图

排序维度：**收益↑ / 风险↓ / 工作量↓** 综合。`★` 越多越优先。

| 优先级 | 改造项 | 收益 | 风险 | 工作量 | 依据（报告章） | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| ★★★★★ | 第五章·无尽 BOSS 链修复（`nextBossRound` 接入循环节点 + 层数强化） | 高（修真 bug） | 低 | 小 | 第五章 | 改 `Game.frame` 时间轴判定即可 |
| ★★★★★ | 第五章·缺失网格 `console.warn` + 洋红占位回退 | 高（防幽灵 Bug） | 低 | 小 | 第五章 | 改 `Gfx.parts` 一处 |
| ★★★★☆ | 复用备份·子弹/经验水晶 `InstancedMesh` | 高（海量弹幕/水晶） | 中 | 中 | 第一章 1.1 | 备份已有实现，移植+适配当前 `Bullets`/`Loot` API |
| ★★★★☆ | 敌人 `InstancedMesh` 化 + 视锥剔除 | 最高（杂兵海） | 高 | 大 | 第一章 1.1 | 需合并多部件几何体为单 geo；伤害闪白改 `instanceColor`；无运行时验证环境，需谨慎 |
| ★★★☆☆ | 关闭 `matrixAutoUpdate` + 手动写矩阵 | 中 | 低 | 中 | 第一章 1.1 / 第二章 | 备份已验证模式，全实体通用 |
| ★★★☆☆ | 小地图 `OffscreenCanvas` + `SharedArrayBuffer` Worker | 中（去主线程） | 中 | 中 | 第二章 2.2 | `file://` 下 `SharedArrayBuffer` 需 COOP/COEP 头，本地双击可能受限（见风险） |
| ★★☆☆☆ | 伤害飘字 SDF/GPU 实例化 | 中 | 高 | 大 | 第二章 2.1 | 需自绘 SDF 图集 + 自定义 shader；当前已有 26 上限兜底 |
| ★★☆☆☆ | 空间哈希 `TypedArray` 化（替代动态 Map） | 中 | 中 | 中 | 第三章 3.1 | 当前 `Grid` 未深查是否 Map，先 profiling 再决定 |
| ★★☆☆☆ | 难度曲线改混合模型（多项式+指数+HardCap） | 高（心流） | 低 | 小 | 第四章 4.3 | 改 `waveSpec` 公式 + 无尽段机制化敌人 |
| ★☆☆☆☆ | 武器标签共鸣 / 超武进化 | 最高（留存） | 高 | 极大 | 第四章 4.1/4.2 | 需扩展 `W_INFO`/卡片/被动体系，设计+平衡工作量最大 |
| ★☆☆☆☆ | 八面体法线压缩 | 低（仅传输） | 中 | 中 | 第一章 1.3 | 重烘焙 + 解码；运行期几乎无感 |
| ☆☆☆☆☆ | WebGPU/TSL 迁移 | 极高（上限） | 极高 | 极大 | 第一章 1.4 | 与 r160 UMD 约束冲突，属长期前瞻，不在本期 |

## 5.4 落地风险与约束提示

1. **验证环境缺失**：`puppeteer-core` 无头环境启动即崩，所有渲染/性能改造**只能 `node --check` + 人工双击验证**，无法自动截图/Profiling。任何 InstancedMesh/Shader 改动必须明确标注"需人工运行时确认"。
2. **`SharedArrayBuffer` 跨源隔离**：`file://` 双击时浏览器通常**不提供** COOP/COEP 头，`SharedArrayBuffer` 可能不可用 → 小地图 Worker 方案需降级为 `postMessage` 传 `Float32Array` 副本（有拷贝开销但仍异步）。这是该条目的关键阻塞风险。
3. **敌人多部件实例化**：`Gfx.enemyShip` 产出的 Group 含 body/outline/cockpit/thruster 多 sub-mesh 且颜色不同，`InstancedMesh` 要求单 geo + 单材质。方案：① 合并同色部件为单 geo（丢细节）；② 用 `BatchedMesh` 按部件分批（第一章 1.2 已建议）。需权衡观感损失。
4. **IIFE/事件总线解耦**（第五章）：属较大重构，有破坏现有可玩版本的风险；建议**独立于游戏性修复**单独评审，不在本期性能改造中捆绑。

## 5.5 建议执行顺序（本期）

1. 第五章两项小修复（BOSS 链 + 网格预警）—— 立即做，零风险。
2. 复用备份：子弹/经验水晶 `InstancedMesh` + 全实体关 `matrixAutoUpdate` —— 中风险中收益，备份已验证。
3. 敌人 `InstancedMesh` + 视锥剔除 —— 高风险高收益，单独提交、人工验证。
4. 难度曲线混合模型 —— 低成本高心流，可并行。
5. 内容层（标签共鸣/超武）与小地图 Worker/SDF 飘字 —— 视资源与验证环境再排期。
