# OneShot 本机媒体服务

完整程序包：https://restartbaiye.github.io/oneshot-studio/OneShot-Windows.zip

## 启动完整工作台

安装 Node.js 18+、FFmpeg/FFprobe（含 libx264 与 drawtext）并加入 PATH；Windows 使用系统微软雅黑字体。依赖不包含在本包中。

双击本目录的 start.bat，看到 listening 后打开 **http://127.0.0.1:41739/?demo=1**。不必另开静态服务器。保持服务窗口运行，Ctrl+C 停止。

默认使用 PATH 中的 ffmpeg 和 ffprobe；自定义安装可在启动前设置 FFMPEG_PATH、FFPROBE_PATH。ONESHOT_PORT 可改端口。启动时用实际字体进行三帧 H.264 / drawtext 编码，再由 FFprobe 核验编码及帧数。未通过不会监听端口；可单独运行 node media-service/doctor.cjs 预检。

命令行也可在项目根目录运行：

    node media-service/server.cjs

## 使用与故障

- 填商品事实 → 生成四句脚本 → 人工批准 → 制作视频 → 下载五份文件。
- 检查已有视频无需脚本审批：可从展厅载入“找到消失的画面”，或到第4步上传视频并运行技术检查。
- 网页提示未连接：检查服务窗口与端口，优先用本机网址；公共 Pages 可能被浏览器本地网络权限拦截。不要放开任意跨域来源。
- 端口占用：关闭旧 OneShot 服务窗口，或设置 ONESHOT_PORT 后启动，不要结束其他应用。
- 字体/编码报错：确认 FFmpeg 含 drawtext/libx264 且系统装有微软雅黑。本轮仅验证 Windows + Edge + FFmpeg 9.0.2，不承诺未经测试的系统兼容性。

## 输出、边界与数据

输出 H.264 1080×1920/24fps MP4、SRT、JPG、JSON 分镜与制作报告。画面是商品静态图/模板背景加字幕，无音轨，不是 AI 生成视频。

技术检查仅包含时长/分辨率/编码、黑场与画面变化阈值，不做语义、法律、商品事实或审美判断。原视频在分析结束后删除（包括失败）；图像临时文件在编码结束后删除；成片和报告保留于项目 deliveries/，停止服务后可自行清理。

最多 8 图，每图 12 MB；视频最多 500 MB、15 分钟。JSON/Base64 会产生额外内存占用，建议短视频。无云端上传、无模型调用、无自动发布。

服务只绑定 127.0.0.1，限制 Host/Origin 与静态文件路径，shell:false 调用 FFmpeg。不要转发端口至公网。本机 API 不提供多用户鉴权；人工审批由网页工作流控制。


### 中文字幕字体

Windows 默认读取系统字体目录中的微软雅黑 `msyh.ttc`，制作时复制到隔离临时目录后显式加载；不会将系统字体打包分发。可设置环境变量 `ONESHOT_FONT` 为支持中文的 TTF/OTF/TTC 文件完整路径。字体不可读会明确报错，不再静默使用缺字字体。视频技术检查不依赖字体。
