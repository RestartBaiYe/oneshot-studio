# OneShot Studio · 方舟 AI 导演台

[打开工作台](https://restartbaiye.github.io/oneshot-studio/) ｜ [下载 Windows 包](https://restartbaiye.github.io/oneshot-studio/OneShot-Windows.zip) ｜ [配置与首次运行](docs/ARK.md)

支持两条清楚区分的路径：DSH 视觉会话生成分镜并以原生 Seedance 插件逐镜确认；或独立的方舟视觉/视频接入点服务器调用。图片 → 观察与四镜脚本 → 人工批准 → 逐镜付费确认 → 取回四镜 → 剪接，输出 MP4、SRT 与含来源记录的 JSON。网页不读取 DSH 密钥、不自动建任务、不从商品图合成假视频。

Windows 运行 media-service/start.bat；须 Node 18+。FFmpeg/FFprobe 用于回检、验证及剪接。无 Key 可创建本机项目、准备 DSH 交接；缺少相应视觉能力或没有完成的云任务时，没有模型成片。npm test 在本机用明确标注的媒体夹具验证，不调用付费 API。

历史比赛资料和旧版示例针对之前的规则工作台，不是当前模型生成结果。原发布基线：0bd75329。
