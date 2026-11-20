# 广告样刊 · 界面设计与验收

设计参考为 [LovroPodobnik/refactoring-ui-skill](https://github.com/LovroPodobnik/refactoring-ui-skill/tree/a9e776a77c3886db3a2978781c6d8c5b5e7b4cbc/.claude/skills/ui-refactor) 的层级、对齐、间距、字体、色彩与深度建议。仅参考设计资料，未向应用安装第三方脚本或运行时依赖。

纸白、墨色、钴蓝贯穿展厅、素材、分镜、审查、交付和双模型设置；深色沿用同样的层级。封面几何线稿为内联 SVG，编辑区始终展示原商品图并标注非生成帧。四个镜头标签对应亮相、购买理由、细节佐证、行动引导；方向键与 Home / End 可选镜，隐藏编辑面板不进入键盘焦点，未保存输入不因切镜丢失。可从交付卡准确定位到对应的镜头。

切镜使用短位移与淡入；返回 AI 候选、完成审批和合并后才出现相应反馈。prefers-reduced-motion 提供即时切换，偏好变化时取消仍在播放的选镜动画。不会用装饰性动画表现云端进度。现有审批、真实提交与原任务状态不变。

工程验证用 tests/integrated.cjs：四镜导航、键盘与未保存稿、减少动效的运行时切换、320/390/768/1280 宽度无整页横向溢出、候选/审查、四个测试片段真正合成。云响应仅为夹具，不代表付费生成。SHOT_CAP 与 SHOT_STAGE 可输出同条件截图。

实拍：[展厅封面](evidence/editorial-cover.png) · [分镜台改前](evidence/editorial-board-before.png) / [分镜台改后](evidence/editorial-board-after.png)。截图使用隔离的测试项目，不使用用户商品或密钥。
