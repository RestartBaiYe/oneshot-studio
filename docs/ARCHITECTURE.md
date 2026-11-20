# 架构与接口

## 运行分层

浏览器：index.html → core/memory.js（本机记忆，最多保留 200 条；仅取同品最近 3 条）→ engine.js（规则与分镜）→ llm.js（适配、用量、请求预算）→ tools.js（注册、输入与工具结果验证）→ planner.js（固定计划及模型解释校验）→ agent.js（编排、预算、审批）→ ui/shell.js、studio.js、media.js、gallery.js、motion.js（视图、证据、媒体、案例）。以浏览器原生 API 为主，无前端框架或服务端 npm 运行依赖。Playwright 仅为开发测试依赖。

本机：media-service/server.cjs 使用 Node HTTP、shell:false 子进程和 FFmpeg/FFprobe，绑定 127.0.0.1。公共 Pages 只提供静态文件；模型请求不经 OneShot 后端。

## 状态及分离

- Workbench.go 管理展厅/四阶段/辅助工具页面；oneshot:navigate 通知导航变化。
- Agent 通过 plan/step/observe/approval/done 等事件发布真实运行状态。执行记录按调用位置匹配，不按工具名去重；同一工具重复检查保留独立条目。
- gallery.js 只载入样例输入，播放器与预置报告独立于 Agent.state.result。完成事件的延迟导航带导航版本检查，不覆盖用户之后的主动跳转；批处理不触发工作区自动导航。
- media.js 在 delivered + deliveryApproved + verdict.pass 且运行结束时才开放新视频制作。输入变动清空旧结果、链接与播放器。
- oneshot:media-ready 只承载本次本机返回的 manifest；预置播放器不发此事件。

## 有界执行

固定顺序：memory.recall → brief.parse → facts.extract → script.draft → compliance.scan → subtitle.fit → review.judge。在线模型不能任意增删工具或执行代码。失败时插入有限 script.revise / subtitle.fit / review.judge；最多三轮审查、40 步、60 秒主动运行预算（等待人类审批不计入）。模型请求超时20秒。失败明确停止，不静默变成离线成功。

通过后执行预览、人工批准的 deliver.export、记忆写入。记忆是浏览器本地历史，不是跨用户知识库。规则审查与人的最终判断分开，不展示伪造的合规分数。

## 本机 API

| 方法/路径 | 作用 |
|---|---|
| GET /api/health | 服务健康 |
| POST /api/render | brief、四句 lines、platform、duration、至多8图 base64 → MP4/SRT/JPG/分镜/制作报告 manifest |
| POST /api/review | video base64 → 元数据、黑场、画面变化阈值报告 |
| GET /api/files/:job/:name | 读取该任务允许的输出文件 |

服务有 Host/Origin、路径、大小和超时限制。单图12MB、至多8图；视频500MB、15分钟。JSON/Base64 有额外内存开销。API 是单机编码器，不提供用户认证或平台发布；勿暴露公网。上传原视频分析后清理，输出保留 deliveries/。静态路由仅允许网页资源和限定 samples 路径，不能读取服务源码。

## 媒体合成与动效

media-service/compositor.cjs 独立处理四镜头时间轴：每镜头按总时长四等分，源片两端预留转场重叠，三次 xfade 不缩短成片。8秒时转场0.4秒，12–30秒时转场0.5秒。zoompan 按余弦缓动推进/横移，1080×1920、24fps；渐变阅读底色、68/52px字幕、长行折行、短入场和四段进度线。文字用 UTF-8 textfile 与 expansion=none，不解释为滤镜表达式。报告记录 editorial-motion-v1、转场数与逐镜运动。

motion.js 管理自己的 Web Animations 与展厅视频：关键图片和字体就绪后允许播放；非展厅、离屏、页面隐藏、打开样例弹窗、节流模式或减少动效时暂停。系统偏好变化会取消所属动画。预置视频始终不发 oneshot:media-ready。

## 已知限制

旧 engine 与 shell 仍包含兼容逻辑；本轮收敛导航和案例边界，未重写整个运行时。固定流程不是开放式规划，规则不是语义/法律审查，图片成片没有配音/生成式镜头。大文件上传尚非流式。
