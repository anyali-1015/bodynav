# BodyNav 薄肌比例导航

黑客松 demo：拍正面/侧面全身照 → 算身材比例 → 和目标身材比 → 给出该练哪块肌肉、每周训练计划，并带摄像头实时计数/纠错的跟练。

- 仓库：https://github.com/anyali-1015/bodynav（分支 `main`）
- 线上：https://anyali-1015.github.io/bodynav/（GitHub Pages，根目录部署，`.nojekyll`）
- 推送 `main` 即上线，属于对外发布，推送前先确认。

## 结构

纯静态单文件应用，无构建、无依赖、无测试。所有代码都在 `index.html`（CSS + 一个 IIFE 脚本）。

- `index.html` — 全部 UI 与逻辑（three.js r128 从 cdnjs 加载）
- `body.mesh.wasm` — 3D 人体网格（MakeHuman 女性基础网格 + 4 个测量形变 + 顶点在 MuscleMap 图上的坐标；自定义二进制格式，见 `meshParse()`）
- `ex/` — 动作照片（free-exercise-db）；`mp/` — MediaPipe 本地副本（失败回退 jsdelivr CDN）
- `pose_landmarker_lite.task` — MediaPipe 姿态模型，本地优先加载
- `bodynav-repo.zip` — 最早版本的打包存档，可忽略

注意：2026-10-16 起的工作版本来自用户发来的 `~/Downloads/薄肌比例导航.zip`，比 GitHub 上的 `main` 新（带 3D 模型、`ex/`、`mp/`）。

本地运行：需要 HTTP 服务（ES module import、摄像头都要求非 file://）：

```bash
python3 -m http.server 8000
```

## index.html 里的主要分区（按出现顺序）

- `TARGETS` 目标身材（swr 肩腰比 / hwr 臀腰比，演示设定值）、`SAMPLES` 样例 A/B（cm 宽度/厚度）
- `EX` 动作库（名称、次数、步骤、要点、易错点、发力肌群）、`MUSCLES` 肌群→可选动作
- 状态：`S`（持久化到 localStorage `bodynav.v4`）、`T`（临时 UI 状态）；照片存在 IndexedDB `bodynav`/`kv`
- `derive()` 由宽度/厚度推算围度（椭圆周长，缺厚度时用 `DEPTH_K` 估算）
- `analyze()` **规则引擎**：肩腰比/臀腰比差距 + 圆肩/骨盆前倾 → 各肌群等级（focus/boost/keep/less，权重 3/2/1/0.5）→ 按约 36 组/周分配
- `weekPlan()` 把肌群分到 A 上肢 / B 下肢 / C 重点强化，`SCHED` 固定在周一/三/五
- `P` 页面表：home、plan、train、library、ex、me、target、posture、about、session、measure 等；`render()`/`go()`/`back()`/`tab()` 是简单的栈式路由，底部三个 tab：身材 / 训练 / 我的
- 3D 首页：`fitBody()` 按测量值拟合形变（测量用）→ `dispMesh()` 只改外观（蛋形人台头 `eggHead`、平滑、`poseArms` 收手臂、`loopSub` 细分一次）→ `build3D()` 顶点色渲染（肌群软渐变 + 凹处暗化 + 边缘菲涅尔）。WebGL 不可用时退回 2D `figureSVG()`
- 测量页两种方式（`T.mtab`）：「手动输入」软尺围度 → `manualMeas()`（围度按 `DEPTH_K` 反推宽度）；「拍照扫描」只用一张正面照 → `scanMeas()`，拖点 `PTDEF.front`、`autoDetect()` 自动放点。`S.meas.src` 记录来源。侧面照相关代码（`PTDEF.side` 等）已不在界面中使用
- 跟练 session：`TRK`（每个动作的计数角度与纠错规则，如耸肩、塌腰、膝内扣）、`say()` 语音播报、`NOTE_RULES` 把用户笔记映射成额外检测
- 事件委托：`ACT` / `COACH_ACT` / `MEAS_ACT`，元素上用 `data-act` + `data-arg`

## 约定

- 核心原则：**规则引擎决定结论，界面只负责解释**。结论必须可复现、可追溯，不要让 LLM 或随机因素改变结论。
- 代码风格：紧凑的单行函数、短变量名、模板字符串拼 HTML，用户文本一律经 `esc()`。保持这种风格，不要引入框架或构建步骤。
- 文案为简体中文。
- 改了 `S` 的结构要考虑旧 localStorage 数据（必要时升级 `KEY` 版本号）。
- `README.md` 的规则表（R1–R8）是早期版本，和当前 `analyze()` 不完全一致（R5/R6/R8 代码里已没有）；改规则时以代码为准，并同步 README。
