# OneShot Studio · 商品内容工作台

[打开案例展厅](https://restartbaiye.github.io/oneshot-studio/) · [下载 Windows 工作台](https://restartbaiye.github.io/oneshot-studio/OneShot-Windows.zip) · [双模型配置与操作指南](docs/ARK.md)

还原 0bd75329 的原工作台界面：展厅看预置作品，任务场记单区分浏览位置和真实进度，审查页保留人工批准与退回。新增的「商品图 AI 制片」复用四步页面：

**商品原图＋介绍 → 已配置的图文模型写四镜脚本和提示词 → 编辑、人工批准 → 方舟视频模型逐镜生成 → 剪接 MP4、SRT 与分镜 JSON。**

公开站不接收双模型 Key。解压后运行 media-service/start.bat，打开本机页面，在左侧「模型配置」分别配置两个模型。默认不提交付费任务。无需模型也可体验原来的示例脚本；示例不代表真实云制片。

验证：npm test；安装 devDependencies 并配置可用 Chromium 后 npm run test:ui。完整接口试跑使用模拟供应商，不上传真实商品图。历史比赛材料对应原版本，不当作新模型实测。

商业广告分镜支持原图参考预览、单镜脚本文案与提示词编辑、AI 优化候选对照、逐镜视频回放和终态重试；见 [分镜工作流](docs/ARK.md)。

[项目广告助手：在同一分镜台查询依据、延续讨论和提出单镜候选](docs/PROJECT-ASSISTANT.md)。

[广告镜头节奏、原版与短剪对照](docs/PACING.md)：5 秒云素材不等于 5 秒成片，可调整入点、选用时长和剪点说明。
