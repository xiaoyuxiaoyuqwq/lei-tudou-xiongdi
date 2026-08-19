# 类土豆兄弟 — 项目长期记忆

## 定位
单文件 3D 幸存者射击，three.js r160 UMD CDN，`file://` 双击即玩。8 分片(p1~p8)经 `tools/build.mjs` 拼 `index.html`。交付文档 `类土豆兄弟_源码与策划书.md`（5 部分：策划书/源码/工具链/第三方评审/核查落地）。

## 硬约束 / 坑
- ⚠️ `Game.start` 顺序：`Player.setShip`+`Player.reset` 必须在 `Progress.reset` **之前**，否则 cfg 漂一格。
- ⚠️ 新增 `HUD.xxxBanner` 类函数时，`p1_shell.html` 必须同步插 `<div id="xxx">`，否则 `id()` 返回 null 卡死开局。
- ⚠️ puppeteer 无头环境损坏（`BrowserLauncher.js:74` 抛 includes），无法运行时验证/截图。兜底：全分片 `node --check` + 人工双击；纯逻辑用 `tools/test_*.mjs`（vm 加载分片断言）。
- ⚠️ `tools/build.mjs` 内联 `three.min.js`/`meshes.js` 去 CDN：**替换值必须用函数** `() => inlineFile(...)`，绝不能用字符串。`three.min.js` 含 `$&`/`$`` 等正则替换惯用法，字符串替换会被当成「反向引用」把 CDN 标签整段重新塞回产物 → 整段脚本解析失败 → `#boot` 一直 LOADING。校验用 `tools/_syntax_check.mjs`（合并后 `vm.Script` 逐段）而非单纯 `node --check`。
- file:// 下**禁** ESM+GLTFLoader+纹理（CORS 死）。模型走离线烘焙 `assets/meshes.js`(17 key，Int16 量化 base64)，`Gfx.*` 还原。

## 渲染架构（InstancedMesh 化，勿回退成逐实例 Mesh）
敌/弹/水晶走 `InstancedMesh`+纯数据池，逐帧 `_flush()` 重写矩阵；陨石/BOSS/玩家/僚机仍独立 Mesh。
- 敌人：`Enemies._insts[variant]`(按 SPEC.variants 建 10+__default，各 cap 300) + `_outline[variant]`(BackSide 1.06× 描边壳，renderOrder=-1)；几何 `Gfx.enemyBodyGeo(vk)` 合并 body 部件（去描边壳/尾焰）；受击闪白/精英/星域染色走 `instanceColor`；`_curTint` 由 director 写。`Gfx.enemyShip` 已无调用方(死代码)。
- 子弹：`Bullets.pInst`(420)/`eInst`(300) + `_flush`；导弹保留 Mesh 池(独立朝向+尾焰)。
- 水晶：`Loot.inst`(Octahedron,400)。
- 缺失 key：`Gfx._mkMissingProxy` 洋红自转占位 + `console.warn` 一次。

## 本期内容扩展（A/B/H/C①/C②/D 已落地；C①–C② 2026-08-13，D 敌人扩张 2026-08-14）
- 难度曲线：`Game.hpMulAt(w)` = `1+0.063·w^1.8` + 后期 exp 阻尼(上限900) + endless×1.35；`spdMul` 无尽放开 2.2、`elite`≤0.25、`w>15` 注相位/炮塔/狙击编队；BOSS 血接同曲线；`waveSpec` 按波缓存。`Game.start` 清 `this._wsCache={}`。
- 标签共鸣：新增 `Synergy` 模块（p7_boss.js），六标签(heavy/precise/energy/ballistic/summon/medical)×3/6/9/12 阶梯；24 武器挂 `tags`；乘算集中在 6 choke point(敌/Boss 伤害、玩家 heal/speed/armor、暴击率/暴伤)；`Progress.reset/applyCard` 自动 `Synergy.refresh()`；选卡显示标签进度、装备栏底部流派阶梯条。其余 mods(控制/元素/弹速/射速/穿透/召唤/受击回血) 预留未接线。
- 主题星际化：`W_INFO` 5 武器改名(轨道切割环/等离子电弧/量子飞轮/等离子灼焰/重力脉冲，内部 key 不动)；`Enemies.SPEC` 加三派系注释(残骸掠夺者/虚空母巢/深渊军团)。
- C① 新武器 4 把（复用现有系统，无新实体系统）：`frost`(energy,命中叠霜、冻结期受伤×1.5、霜蓝lerp；p4 加 frost 字段+p6 加 frostLv/frostT/`_flush` 霜色)、`meteor`(heavy,锁定密集区、Asteroids.geos 残骸坠落Mesh+Enemies.splash AoE、自管 `Weapons.meteors[]`)、`swarm`(barrage,复用导弹池 scale0.5 + pickTargets 齐射)、`storm`(energy,复用 `_chainBeam` 天空雷击随机抽敌+Enemies.damage)。均进 `W_INFO`→自动进三选一；Audio2 加 frostZap/meteorWarn/meteorFall/stormCrack。各 5 级。
- C② 新武器 7 把（全新实体系统）：`blackhole`(energy,引力井吸附+静默DOT+坍缩爆发;`Weapons.blackholes[]`+Group 几何)、`phase`(medical,周期相位护盾;`Player.phaseHp/phaseMesh` 先于护甲承伤)、`photon`(precise,命中弹射至最近其他敌、限 bounce 次;`Weapons.photons[]`)、`tractor`(heavy,常驻引力场聚敌+减速+DOT;`tractorMesh`)、`rotor`(barrage,环绕相位节点接触杀伤;`rotorNodes[]` 最多6)、`mine`(barrage,周围布雷敌近即爆;`minePool` 28 槽)、`nano`(medical,周期治疗;`Player.heal`)。各 5 级；`Enemies.damage` 增 `fx` 静默参支持 DOT；`W_INFO` 加 7 条+`tags`；Audio2 加 7 音效;`Progress.describe` 加 7 分支。
- D 敌人扩张（新敌种+变异，2026-08-14）：新增 2 敌种 `bomber`(ai 'bomber',蓄势逼近、接触/死亡AoE爆裂、走通用化 `blastQ` 四元组 `[x,z,r,dmg]` 迭代结算防递归) + `weaver`(ai 'weave',中距 strafe 走位+周期三连远程爆发)；6 种精英变异 `MUT`(armored/swift/regen/berserk/toxic/split,`_rollMut` 按波次概率触发、`spawn(allowMut)` 防分裂/召唤递归)；变异表现原用独立地面光环 `auraInst`(单 InstancedMesh 加色环)，后于 VIS 轮(2026-08-15)移除、改为直接染敌体发光(见 VIS 条)；`Player` 加 `poisonT/poisonDps`+`applyPoison` 中毒(走既有死亡路径)；`STAGES` 4/5 星域池含 bomber/weaver(`w>15` 复合编队 concat)。`test_synergy.mjs` 第10组校验 SPEC/MUT/STAGES 接入,共 **10 组~40+项断言 ALL PASS**;文档§D2。
- 音乐 BGM + 设置菜单（2026-08-14）：BGM 引擎(p3 程序化合成 Am-F-C-G 四小节循环)早已存在并接线(p8 start/stopMusic)，本轮未从零造乐，仅升级**自适应**(新增 `_updateMusic`：强度=敌人密度+波次+Boss激昂(≥2.2)+残血紧张(HP<30%)，BPM 随波次/Boss 平滑提速，加 Boss 低音脉冲+残血不祥低鸣情绪层)。设置菜单：`Settings` 全局(p3, vol{master,sfx,music}+binds{up,down,left,right,dash,form,pause}, localStorage 持久化+try/catch 兜底)；`Audio2.setMasterVol/setSfxVol/setMusicVol` 实时写增益；`Input` 重构读 `Settings.binds`(方向键固定备用、Esc 暂停别名)+`rebind(action)` 捕获模式(点键位→按任意键写入→Esc 取消)；p1 `#settings` 浮层(z55, 3 音量滑块+7 键位按钮+完成键)、暂停面板与菜单各加「设置」入口。`test_synergy.mjs` 第11组校验 Settings 结构/Audio2 音量方法/_updateMusic 实跑 → **11 组全 PASS**;文档§BGM。
- 视觉与难度打磨 VIS（2026-08-15）：敌体 `MeshLambertMaterial` 加 `onBeforeCompile` 注入 `totalEmissiveRadiance += vColor*0.5`，让 `instanceColor` **自发光**（暗场也鲜明，修复「敌人没颜色」回归）；**移除** D 加的变异地面光环 `_aura`，变异改为直接染敌体(`_flush` 中 `e.color` 向 `MUT[e.mut].color` lerp 0.5)；场景先提亮(p3 背景 `0x05070f→0x0c1322`/雾推远/环境光转白增亮+`HemisphereLight`/主光1.95/边缘光0.75，5 星域 `STAGES` bg/fog 提亮) 但同日晚**二次反馈回退**——背景/雾/环境光/半球光/主光/星域 bg·fog 全部还原成原版暗色(背景 `0x0c1322→0x05070f`、环境光 `0xb4cdec,1.7→0x4a6a95,1.15`、删 `HemisphereLight`、主光1.5/边缘光0.55、星域残骸 `0x2c2118→0x0c0a08` 等)，靠暗背景找回对比度、敌体自发光(`vColor*0.5`)在暗场颜色鲜明清晰——即用户要的「开始版本」配色；另同日晚**再修正兵种本色**：`spawn()` 上色由 `tint != null ? tint : S.color` 改为 `elite ? 0xffe0a0 : S.color`，星域染色不再覆盖敌体，敌人恢复「不同兵种不同颜色」(charger红/orbiter紫/sniper青…)，星域氛围改由背景/雾承担；新增**地狱模式**(主菜单 `btnHell` 常显无需解锁，`Game.start(false,true)`：血量×2.2、刷怪间隔×0.62+每波`+1+floor(w/4)`、速度×1.3、精英更早更高、变异率×2.4、HUD 红色「难度：地狱」徽标 `diffChip`)。`test_synergy.mjs` 第12组加载 p8 校验地狱缩放(hpMulAt×2.2/waveSpec per·精英率更高/按波缓存) → **12 组全 PASS**;文档§VIS。
- Boss 崩溃修复 + 地狱数值 + E 武器更丰富（2026-08-15 本轮，用户 5 项需求全交付）：【A 修复】boss 出现报错根因=`Boss.asTarget()` 返回轻量桩无 `.kind` 字段，被 `Enemies.damage` 当普通敌走 `SPEC[undefined].color` 崩溃；修复=`Boss.asTarget` 加 `isBoss=true` + `Enemies.damage` 顶部 `if(e&&e.isBoss){Boss.damage(dmg,crit,hx,hz);return;}`。离线复现 `tools/repro_boss.mjs`(vm 实跑：桩 WebGLRenderer+DOM/Audio，跑 boss 全生命周期；用法 `node tools/repro_boss.mjs [hell]`)双模式回归通过。【B/C/D 地狱数值】新增 `CFG.hell`{collideMul:0.25(撞击=玩家总血量×1/4)、enemyWpnMul:1.7(敌弹伤害)、hpMul:3.0(难度曲线血量)、grow:2.2(刷怪成长)、spdMul:1.5(敌速)}；接入点：p6 `Enemies.damage`/brute死亡爆裂 撞击倍率、p4 `Bullets.enemyFire` 敌弹倍率、p8 `hpMulAt`/`waveSpec` 曲线倍率。【E 武器更丰富·两者都要】新增 3 玩家武器：`radial`(barrage,环形弹幕,无目标)、`reflect`(heavy,反射敌弹+周期灼烧近身,新增 `reflectMesh` 力场环)、`lance`(precise/heavy,蓄能穿透重矛,新增 `lanceMesh` 充能指示+`lanceCharging` 状态机)；接入点 p3 Audio2(radialShot/reflect/lance)、p5 `TABLE`+`cd`+`init`+`reset`+`update` 三块(并加 `Weapons.t` 时钟)、p7 `W_INFO`+`describe`。新增 2 boss 攻击：`螺旋弹幕`(P1/P2 多臂螺旋 `Bullets.enemyFire`)+`扫射激光`(P2 限定,新增 `bossLaser` 细圆柱光束+窄带命中 `Player.takeDamage(15)`)；接入点 p7 `Boss.update`+`init`(bossLaser)+`spawn`(计时器重置)+`die/clear`(隐藏激光)。重建 `index.html` 语法全过、双模式 boss 回归无异常(普通 bossHP 49183 / 地狱 147549,均跑完 出现→阶段II→死亡)。

## 交付同步
改完代码跑 **`python tools/sync_doc.py`** 重建文档第二部分(8 分片)+第三部分(build.mjs/bake_models.mjs)，手写文字原样保留、幂等。手写章节(§4.3/§6/§7/§5.6/§5.7)需人工同步。

## 关键文件
`index.html` | `build/`(p1~p8) | `assets/meshes.js`(17 key) | `tools/`(build/sync_doc/test_synergy) | `类土豆兄弟_源码与策划书.md` | 备份 `build_bak_*/index_bak_*.html`

## 下一步（用户已拍板全路线图，2026-08-14 起）
「设置菜单+自适应BGM」「VIS(敌人发光+提亮+地狱模式)」「Boss崩溃修复+地狱数值+E武器更丰富」「2026-08-17 大优化包(敌人阵营涂装+僚机索敌优先级+ boss 激光预警+ 场景危害 Hazards + 小Boss 战帅)」均已完成。「地狱模式」可直接体验。按用户选定顺序推进：**E 僚机索敌(已完成) → G 场景危害(已做 Hazards 中立危害，原「危害」或更广) → Boss 多样化+小Boss(已加 2 新攻击形态 + 战帅 warlord；可再加第二 BOSS 体型) → 新模式(Boss Rush / 每日挑战种子化 / 无尽+) → 局外成长 Meta(跨局永久解锁/货币) → I 整体美化**。另有待做：**B 武器槽 4→6+swap UI**（C 提前铺满，防软锁，待做）、验证链路重建（puppeteer 仍坏；test_synergy 覆盖 纯数学/共鸣/标签/敌种变异/设置/地狱缩放；repro_boss 覆盖 boss 全生命周期+新武器/攻击+战帅/Hazards；运行时观感仍靠人工双击 `index.html`）。

## 本轮新增系统速查（2026-08-17）
- 敌人阵营涂装：`EFAC`(兵种→scrap/void/abyss) + `FAC`(阵营色) 在 `Enemies.spawn` 叠 18% 到 `e.color`；精英仍 0xffe0a0。
- `Hazards` 模块(p6 尾部)：`init/reset/update` 三步接 Game；**双性质场景触发（太空主题）**：坏区 `BAD`(等离子风暴/恒星耀斑带/引力裂隙/辐射云团，`Player.envDmg` 每0.4s 掉血、敌人也被削) + 好区 `GOOD`(维修立场回血 / 友军炮台立场召唤 2 座友军炮台朝最近敌开火，即「更多友军」)；`_mk(forceKey)` 约 45% 刷好区，toast 前缀「⚠ 星域异常」/「✚ 友军增援」。改名 `熔火地带→恒星耀斑带` 贴合太空背景。
- 小Boss `warlord`：`SPEC.warlord` + `ai==='warlord'` 分支(环形弹幕+突进)；director `wave>=8 && wave%5==0 && !Boss.active` 刷。
- boss 扫射激光预警：`Boss.sweepWarn`(0.55s 细光束无伤) → `sweepT` 横扫。

## 双人模式 + 新战机/新友军（2026-08-17 续写，已交付）
- **双人（支持双人）全链路落地**：`Player2`=青色 WASD 实例；`Weapons2`/`Progress2` 经 `Object.create` 工厂继承方法但独立可变状态；`Game.coop` + `players[]` + `alivePlayers/nearestPlayer/spawnCenter`；升级按玩家独立排队(`_levelQueue`/`_levelPlayer`)；死亡判定 `onPlayerDead`(全员阵亡才 `over`)；双人中点镜头随距离拉远；`Input.move(id)/dash(id)` + `Settings.binds2`。**Boss 攻击/碰撞锁定最近玩家**(`p7` update 内 `tp`)。
- 外壳/HUD：`btnCoop` 开关 + `Game._coopSel` 偏好；`#hpWrap2` P2 血条(仅双人显)；`showLevelUp` 标「P1/P2」；`setCoopUi()` 切 P2 血条+操作提示。
- **新战机敌种**：`raptor`(ai weave, `proc_raptor` 箭形机身+后掠翼+双垂尾) + `gunship`(ai orbit, `proc_gunship` 宽机身+大翼+背炮塔+尾引擎)；接 `SPEC`/`EFAC`/`STAGES`。
- **新友军僚机**：`spitfire`(喷火) + `bulwark`(壁垒)；接 `Wingmen.SPEC`+`G_INFO`(自动进三选一)，通用开火分支(子弹色=`w.spec.color`)。
- 验证：`_syntax_check`(4段)✓ · `build.mjs`→`index.html`(1.1MB自包含)✓ · `repro_boss.mjs` normal/coop/hell/coop+hell 四模式 boss 全生命周期无异常✓ · `check_procmodels.mjs` 覆盖 raptor/gunship 专属几何✓。
- 用户原三项需求(更多战机敌人/更多友军/支持双人)已全部交付。
