# OneShot 本机媒体服务

浏览器 Pages 版本负责脚本工作流；本机 Node 服务负责视频编码与技术抽样。服务只绑定 `127.0.0.1`，不对局域网开放。

## 启动

在项目根目录双击 `media-service/start.bat`，保持命令窗口运行，然后在「视频工坊」点击重新连接。默认端口为 `41739`。

运行环境需要 Node.js 18+、FFmpeg（含 libx264 和 drawtext）与微软雅黑字体。默认查找 `D:/Python314/Scripts/ffmpeg.exe` 和同目录 ffprobe；其他环境请设置 `FFMPEG_PATH`、`FFPROBE_PATH`。命令行启动：

```sh
node media-service/server.cjs
```

## 功能和限制

- 四句已审脚本与最多 8 张 PNG/JPEG/WebP 商品图，制作 H.264 1080×1920、24 fps MP4。
- 输出 MP4、SRT、JPG 封面、JSON 分镜和制作报告。静态商品图或模板背景加字幕；无视频生成素材、无音轨、无配音。
- 上传视频后使用 FFprobe 读取元数据，并用 FFmpeg 黑场和画面变化阈值检测，输出 JSON 技术报告；分析结束即删除上传的原视频，仅保留报告。
- 服务不调用模型，不判断语义、商品事实、广告法或美学，不自动发布。网页模型只参与文字工作流。
- 商品图每张不超过 12 MB；视频不超过 500 MB、最长 15 分钟。成片、脚本配套文件与审查报告保留于本机项目 `deliveries/`；审查上传的原视频在任务结束时删除。停止服务后可手动删除 `deliveries/`。

服务绑定 `127.0.0.1` 并以 `shell:false` 启动 FFmpeg。不要将 41739 端口转发至公网。停止服务后可手动删除 `deliveries/`。Pages 用户可通过 `demo/media-service/README.md` 查看浏览器版安装指引。
