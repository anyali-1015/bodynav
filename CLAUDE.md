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
- 主屏 App（PWA）：`manifest.webmanifest`、`icons/`（由脚本生成：绿底 + 肩/腰/臀三条软尺线）、`sw.js`（页面网络优先，其余资源缓存优先）。**改了 index.html 以外的资源（body.mesh.wasm、ex/、mp/、icons/）时把 `sw.js` 里的 `VERSION` 加一**，否则已安装的手机会一直用旧缓存。iPhone 安装：Safari 打开 → 分享 → 添加到主屏幕（微信内置浏览器不行）
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
- 性别：`S.sex`（'f' / 'm' / 未选），`sx()` 取值（未选按女）。`TARGETS`、`SAMPLES` 都带 `sex`；`DEPTH_KS` / `NORMS` 按性别给厚宽比和骨架上限；`S.tgt.sex`、`S.meas.sex` 记录生成时的性别。切换走 `ACT.setSex`。3D 只有女性基础网格，男性显示时 `flatChest` 按锁骨下和胸下两条带的真实表面插值，把整片胸压平（不要再用两侧分别拟合，会凹进去两块）
- 目标：`TARGETS` 预设只有比例；`S.target==='mine'` 时用 `S.tgt`（kind: auto / custom / ref，存四项 cm）。`target()` 统一返回 `{name, swr, hwr, cm?}`。`capOf()` 骨架上限、`autoCm()` 下一阶段生成、`refCalc()/refToCm()` 参考照片提取与换算、`gapRows()` 逐项差距表
- `bodyAdvice()` 体型建议（规则 A0–A5）：和按身高的理想值比，始终至少给一条；`analyze()` 把前两条加进计划，目标达成时首页标题用第一条
- `analyze()` **规则引擎**：预设按比例差距、「我的目标」按每项 cm 差距（阈值 `TOL` / `GAP_TH`，显示和规则共用），加圆肩/骨盆前倾 → 各肌群等级（focus/boost/keep/less，权重 3/2/1/0.5）→ 按约 36 组/周分配；返回 `reached`、`notes`。规则表见 README
- `weekPlan()` 把肌群分到 A 上肢 / B 下肢 / C 重点强化；`S.days`（用户在「我的 → 训练日」选的周几）经 `sched()` 轮换成每天的 A/B/C，2/4 天用两分（`twoSplit()`）
- `dayItems(date,k,plan)` 是某一天实际要做的动作：`WARM` 热身 + 计划 + 用户自选，按 `S.day[date]` 里的 order/add/del/wu/k 调整；训练页拖动排序、动作库「+」、整体跟练（`buildQueue('day:日期')`）都基于它
- 历史回顾：`S.log`（每次保存测量记一笔）+ IndexedDB `bodynav.hist.<日期>` 照片；`histHTML()` 画曲线和照片对比，`S.remind` 控制提醒间隔
- `P` 页面表：home、plan、train、library、ex、me、target、posture、about、session、measure 等；`render()`/`go()`/`back()`/`tab()` 是简单的栈式路由，底部三个 tab：身材 / 训练 / 我的
- 3D 建模的尺寸先过 `plausible()`：不合人体常理的组合（臀/腰、腿/臀超出 `PLAUS` 范围）按边界收回再建模，只影响外形，标签和计划仍用实测值，并在首页 / 测量页提示核对。`fitBody()` 的形变权重限制在设计范围附近（腿围尤其不能大幅取负，否则大腿根出凹坑），剩余的腿围差距由 `scaleLegs()` 整条腿平滑缩放
- 3D 首页：`fitBody()` 按测量值拟合形变（测量用）→ `dispMesh()` 只改外观（人台头 `eggHead`：头高 = 身高 ÷ 7.5 锚定在头顶、脖子是一根椭圆柱、下颌和后颈松弛成圆角；`smoothChest` 抹平乳头；`poseArms` 收手臂；`loopSub` 细分一次；按性别分别缓存）→ `build3D()` 顶点色渲染：只给没达标的测量部位上色（以测量环为中心的高斯渐隐，约 45%），达标部位保持素模，点选肌肉才用主色；柔光 + 边缘菲涅尔 + 两层接触阴影。肩宽画成身前带端点的尺寸线，其余是环；标签分左右两侧（肩宽、臀围在右，腰围、腿围在左），三列对齐（名称 / 数值 cm / 差 或 多），引线从环上靠近标签的点引出。首页标题是目标名 + `figSummary()`（几项未达标 + 图例）。WebGL 不可用时退回 2D `figureSVG()`
- 测量页两种方式（`T.mtab`）：「手动输入」软尺围度 → `manualMeas()`（围度按 `DEPTH_K` 反推宽度）；「拍照扫描」只用一张正面照 → `scanMeas()`，拖点 `PTDEF.front`、`autoDetect()` 自动放点。参考照片页 `refphoto` 复用同一套（`T.step==='ref'`，`PTDEF.ref` = 正面点位）。`S.meas.src` 记录来源。侧面照相关代码（`PTDEF.side` 等）已不在界面中使用
- 跟练 session：`TRK`（每个动作的计数角度与纠错规则，如耸肩、塌腰、膝内扣）、`say()` 语音播报、`NOTE_RULES` 把用户笔记映射成额外检测。两种入口：训练页整体跟练（`startCoach('day:日期')`，按 `dayItems` 的顺序）和动作详情单独跟练（`startCoach('ex:动作:组数')`，`C.single`）。每个 `EX` 动作都要在 `TRK_OF` 里有对应的计数器，没有的会退成计时
- 语音坑：iOS 必须在点击里同步说出第一句才解锁（别在那之前 `cancel()`）；`cancel()` 后同一时刻 `speak()` 会被丢掉，`say({urgent})` 已改成先 cancel 再延迟 150ms；中文语音等 `voiceschanged` 再选
- 事件委托：`ACT` / `COACH_ACT` / `MEAS_ACT`，元素上用 `data-act` + `data-arg`

## 约定

- 核心原则：**规则引擎决定结论，界面只负责解释**。结论必须可复现、可追溯，不要让 LLM 或随机因素改变结论。
- 代码风格：紧凑的单行函数、短变量名、模板字符串拼 HTML，用户文本一律经 `esc()`。保持这种风格，不要引入框架或构建步骤。
- 文案为简体中文。
- 改了 `S` 的结构要考虑旧 localStorage 数据（必要时升级 `KEY` 版本号）。
- `README.md` 的规则表与 `analyze()` 一一对应；改规则时同步更新 README。
