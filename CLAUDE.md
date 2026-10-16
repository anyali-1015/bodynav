# BodyNav 薄肌比例导航

目标驱动的训练计划 + 肌群知识（PRD v1.0 / P0）：首次引导选体型目标、每周次数、经验、器械 → 自动生成分化计划；「训练」页打开就知道今天练什么，周视图记录练了哪些肌群，3D 肌群图谱解释每块肌肉，摄像头跟练自动计数。测量降为可选，只记录自己的变化。

- 仓库：https://github.com/anyali-1015/bodynav（分支 `main`）
- 线上：https://anyali-1015.github.io/bodynav/（GitHub Pages，根目录部署，`.nojekyll`）
- PRD：https://claude.ai/artifact/7chuVLDUUx2YN9dFFMwndH（「当前版本已知问题」一节是 2026-10-16 的试用报告）
- 推送 `main` 即上线，属于对外发布，推送前先确认。本机 git 没有 GitHub 凭据：用 Claude in Chrome（登录 anyali-1015）走网页上传

## 结构

纯静态单文件应用，无构建、无依赖、无测试。所有代码都在 `index.html`（CSS + 一个 IIFE 脚本）。

- `index.html` — 全部 UI 与逻辑（three.js r128 从 cdnjs 加载）
- `body.mesh.wasm` — 3D 人体网格（MakeHuman 女性基础网格 + 4 个测量形变 + 顶点在 MuscleMap 图上的坐标；自定义二进制格式，见 `meshParse()`）
- `ex/` — 动作照片（free-exercise-db）；`mp/` — MediaPipe 本地副本（失败回退 jsdelivr CDN）
- `pose_landmarker_lite.task` — MediaPipe 姿态模型，本地优先加载
- 主屏 App（PWA）：`manifest.webmanifest`、`icons/`、`sw.js`（页面网络优先，其余资源缓存优先）。**改了 index.html 以外的资源（manifest、body.mesh.wasm、ex/、mp/、icons/）时把 `sw.js` 里的 `VERSION` 加一**，否则已安装的手机会一直用旧缓存
- `bodynav-repo.zip` — 最早版本的打包存档，可忽略

本地运行：需要 HTTP 服务（ES module import、摄像头都要求非 file://）：

```bash
python3 -m http.server 8000
```

## index.html 里的主要分区（按出现顺序）

- 数据：`GOALS`（按性别的体型目标 → 主练肌群）、`EXP`（经验 → 组数）、`EQ`（器械）、`SPLITS`（每周次数 → 轮转顺序）、`BASE_BODY`（没有测量时肌群图谱用的常见体型）、`EX` 动作库 + `EX_META`（器械、难度、是否复合、第二条常见错误、受伤风险点）、`MUSCLES`（计划用的 9 个肌群 → 可选动作，同组互为替代）、`RINFO`（3D 可点区块 → 名称、作用、对体型的影响、动作）
- 状态：`S` 持久化到 localStorage `bodynav.v5`（从 v4 迁移性别、备注、语音、自己的测量；样例和厘米目标不再用），`T` 临时 UI 状态；照片存在 IndexedDB `bodynav`/`kv`
- **计划引擎**（规则见 README）：`mainMus()` 主练肌群 → `sessionItems(key)` 一次训练的动作（全身 A/B 或上下肢，主练 2 个动作 / 次的情况、组数、先复合后孤立、器械过滤 `eqOK`、单次最多 8 个、体态拉伸）→ `sessionFor(key,date)` 加上当天临时替换 `S.daySwap`。`S.rot` 是已完成次数，`nextKey()` 决定下一次练哪个；漏练 / `logSkip()` 不前进 → 自动顺延。`todayState()` 判断完成 / 跳过 / 建议休息（同一主练肌群 < 48 小时，或本周次数已练完）。`S.log` 每天一条，`weekDays()` 给周视图
- 替换：`swapToday` 一键在同组轮换（只今天）；动作页 `swapTo` 选具体动作；`keepSwap` 写进 `S.swap[肌群:变体奇偶]`，以后都用
- `P` 页面：onb（首次引导）、settings（训练设置，与引导共用 `planForm()`）、today（训练，默认首页）、week（周视图）、atlas（3D 肌群图谱）、library、ex、me、measure（可选身体数据，只显示自己的历史）、posture、install、about、session。没完成引导时 `render()` 只允许 onb / about
- 3D 肌群图谱：`bodyM()`（自己的测量或常见体型）→ `plausible()` 收回不合常理的尺寸 → `fitBody()`（形变限幅 + `scaleLegs()`）→ `dispMesh()`（人台头 `eggHead`、`smoothChest`、`poseArms`、`loopSub`，按性别缓存）→ `build3D()` 顶点色渲染，主练肌群高亮，不画软尺、不出数字。WebGL 不可用时 `atlasFallback()` 用 2D 肌群图
- 测量（可选）：「手动输入」`manualMeas()` / 「拍照扫描」`scanMeas()` + `autoDetect()`；保存进 `S.meas` 和 `S.measLog`，`measHistory()` 只和自己第一次比
- 跟练 session：`TRK`（每个动作的计数角度与纠错规则）、`say()` 语音、`NOTE_RULES` 把备注映射成额外检测。入口：训练页整体跟练（`startCoach('today')`，完成后 `logDone`）和动作页单独跟练（`startCoach('ex:动作:组数')`，`C.single`）。每个 `EX` 动作都要在 `TRK_OF` 里有计数器，没有的会退成计时
- 语音坑：iOS 必须在点击里同步说出第一句才解锁（别在那之前 `cancel()`）；`cancel()` 后同一时刻 `speak()` 会被丢掉，`say({urgent})` 先 cancel 再延迟 150ms；中文语音等 `voiceschanged` 再选
- 事件委托：`ACT` / `COACH_ACT` / `MEAS_ACT`，元素上用 `data-act` + `data-arg`

## 约定

- 核心原则：**规则决定计划，界面只负责解释**。同样的设置永远得到同样的计划，不要让 LLM 或随机因素改变它。
- 安全护栏（PRD）：首页和计划页不出「差 X cm」等缺陷数字，文案用「加强」「进展」，不用「差距」「不够」；腰线目标要说明不能局部减脂；身体数据只和自己比。
- 代码风格：紧凑的单行函数、短变量名、模板字符串拼 HTML，用户文本一律经 `esc()`。保持这种风格，不要引入框架或构建步骤。一行写完的函数里不要用 `//` 注释（会吞掉后半行），用 `/* */`。
- 文案为简体中文。
- 改了 `S` 的结构要考虑旧 localStorage 数据（必要时升级 `KEY` 版本号并写迁移）。
- `README.md` 的规则表与计划引擎一一对应；改规则时同步更新 README。
