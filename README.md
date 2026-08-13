# 星渊幸存者 · STELLAR SURVIVORS

一款《吸血鬼幸存者》式的**太空战机 Roguelite**，俯视 2.5D 星空战场，赛博霓虹美术风格。

> 「你只管走位，开火交给战机会自己来。」

## 玩法

- 自动索敌开火 + 手动走位，低操作门槛
- 清怪掉落经验晶体 → 磁力拾取 → 升级三选一（武器 / 被动 / 僚机 / 进化）
- 单局约 15 分钟：15 波敌潮，W5 / W10 精英，W15 BOSS，通关解锁无尽模式
- 死亡即毕业：成长不带入下局，靠解锁 / 图鉴提供长期目标

## 运行

直接双击 `index.html` 即可游玩（单文件 HTML + three.js，无需构建）。

操作：`WASD` / 方向键移动。

## 项目结构

```
index.html        可运行成品（由 build/ 分片拼接而成）
build/            源码分片（p1_shell ~ p8_game）
tools/            构建、自检、截图脚本
assets/           美术与模型资源（models.js / meshes.js 等）
docs_src/         文档源文件
策划书.md         游戏策划书
```

## 从源码构建

```
node tools/build.mjs
```

会把 `build/` 下的分片拼接生成单文件 `index.html`。

## 自检

项目内置多组无头自检脚本（`tools/verify_*.mjs`、`tools/check.mjs` 等），用于验证玩法、武器、敌人、UI 等模块是否正常。

## 文档

- [策划书.md](策划书.md) — 完整游戏策划书（核心循环、敌人系统、成长系统、UI 与美术方向等）
