# 抖音广告与遥测适配

本次加入 3 条响应重写和 4 条精确遥测拒绝。游戏广告一起过滤，普通游戏创作保留。它是旧 Android 样本推导的静态适配，不是当前 iOS 版本已验证的零广告方案。

## 来源与身份

样本来自[抖音官方下载页](https://www.douyin.com/downloadpage/app)公开配置中的[Android 安装包](https://lf-douyin-pc-web.douyinstatic.com/obj/douyin-pc-web/android-32.2.6/douyin.apk)。原始大小 270,981,537 字节，SHA-256 为 `46a3ebd3cf4b9a5020ebcea3aee02facaa80a7baae492b2c12090e5e0999baf0`。

原 Manifest 确认包名 `com.ss.android.ugc.aweme.mobile`、32.2.6 / 320206；不能称为 2026 最新标准手机版。原包 34 DEX 的完整 JADX 分析因内存/时限未完成，成功 REA 证据使用逐字节保留原 Manifest 和目标 DEX 的未签名派生载体，完整调用图及动态/native 路径未覆盖。身份 Evidence 为 `ev_ae43c0e044b4ed16160ee60f48faeac15abfa8b1bdd8155fc7fbf9ac940b26c7`，其 subject 是身份载体，不是全包分析。

未安装或执行 APK，未登录、请求广告/业务接口、绕过证书绑定或采集用户流量。未验证 APK 签名，也没有 iOS 真机样本。原 APK、派生物和完整反编译结果不随订阅分发。

## 信息流与图片封面

静态初始化链将三种 API host 配置为 `aweme.snssdk.com`，再由 CommonConstants 拼成 HTTPS 地址并创建 FeedApi。内容规则仅接受该精确主机及默认端口或显式 443；地区改写、动态 host、其他 amemv 别名和 iOS host 尚未确认，不以通配符扩大。

| 接口 | 处理 |
| --- | --- |
| `/aweme/v1/feed/` | Retrofit 声明的 immediate feed，识别 JSON 根列表 |
| `/aweme/v2/feed/` | 默认推荐流，GET/POST 都可匹配 |
| `/aweme/v2/preview/feed/` | 样本实际选择的预览路径 |

根 `aweme_list` 与 `preload_ads` 的条目仅在 `is_ads === true` 且 `raw_ad_data` 为非 null、非数组对象时移除。REA 的 `Aweme.isAd()` 是布尔标记与内部广告对象非 null 的联合判断；空 JSON 对象也按非 null 对象处理，是明确的 wire 设计推断，不是已验证的 iOS 反序列化结果。字符串 true、数字 1、缺失/空值、仅 raw_ad_data 等模糊形态不盲删。

图片类型 2、多图类型 68、video.cover、dynamic_cover、游戏/小游戏字段、下载链接、13017 游戏锚点和文案均不能独立判广告。图片或游戏广告满足联合谓词时整项移除，其封面随该条目一起去除；普通图文、封面和游戏内容保留。不封共享图片/视频 CDN，也不凭封面图像识别视频内容。

代码删除的是原始 JSON 数组条目的字节区间，不重序列化保留项；64 位 ID、cursor、指数表示、字符串转义和外部元数据保留。重复决策键、异常 JSON、未知结构、非字符串正文、超限正文或不支持的编码不改写，不递归查杀任意嵌套对象。`has_more` 不按删除后的长度重算。

主要证据：

- 默认 host 初始化：`ev_864b3d1b8ea6b81e3fadd50f3accc0e04d2369b6e84bdde58af260387422ed64`。
- feed 路径、GET/POST 和 preloadAds 消费：`ev_af4b80873a7ad46cc89d625c6a3123ddae01eba0f27685a22c5af49a26ed2dd9`；v1 声明另由原 DEX 注解辅助确认，不冒充 REA 方法体。
- 联合广告判断：`ev_009b0e653e708d6ea885151dac81693bc4a200e10beccbf35f6d77fefdb22b42`。
- 图片广告控制：`ev_4c470c9e8f49deeb5728cc7ededd178cac0aba1a669065c4ce4244b2726d3982`。
- 游戏入口同时处理 natural、dou_plus、effective_ad：`ev_0ffe020a0eb622b4d689eaab35913d1dc40dbddf28b789cbddfb30e72ca6927c`。因此不按游戏锚点删除所有视频；未独立覆盖全部 DOU+ 或嵌入创作的软广告。

## 开屏

| 接口 | 已确认字段与设计 |
| --- | --- |
| `/api/ad/splash/{appName}/v14/` | appName 接受单个受限安全段；不声称固定为 aweme。清 `data.splash`、`preload_feed_ads`、`marketing_splash`、`realtime_preload_splash` 四个已确认的广告 SDK 数组 |
| `/api/ad/splash/realtime/aweme/v14/` | 清 `data.splash_ads`，它是 CID 选择表，不是完整创意数组 |

预加载消费者依据 HTTP 成功和 data，而非强制 JSON code。实现保守接受 code=0，或已知 HTTP 2xx 且没有 JSON code；已知 HTTP 失败、显式错误 code、重复决策键不改写。实时仍要求 code=0。marketing_splash 经过同一 QFg 广告模型解析，故本版一并清除；不是清空普通营销控制字段或其他 App 的混合优惠券容器。

`no_change_show_list=true` 会阻止主列表替换。本版在识别到广告列表时有意改为 false，让主缓存更新为空；间隔、频控、marketing_control_info、expire_ads、模式与配置保留。

主缓存变空不等于全部旧库存消失。另有旧库存按有效期保留；实时 action_type=1 会回退预加载，本版保留该控制位。实时空 CID 表的选择函数返回 null，但总协调方法未恢复完整正文，不能保证所有缓存回退均消除。旧广告在响应改写之前显示，也不由此规则修复。

主要证据：预加载 `ev_1d5bca6413ca9c329ce1cc772c61bc994cb54979c042a22bc6fa41bb65212582`；实时 `ev_e03247284dfc5e9fc5fe67627df2b110577a5a716c2e72ebda462a6e1c52bd17`；空 CID 选择 `ev_c6e6cdf00ef8fd91e3280d2266cd0af8dd66fca9882af3086307af62c10504c8`。

## 遥测

| 精确路径 | 安装包配置中确认的主机 |
| --- | --- |
| `/service/2/app_log/` | log/applog/rtlog.zijieapi.com，以及 log/rtlog/rtapplog.snssdk.com |
| `/service/2/app_log_monitor/` | log.zijieapi.com |
| `/monitor/collect/` | mon.snssdk.com、mon.zijieapi.com |

合计四条 regex、八个独立主机。它们是已出现于包内配置或 SDK 注册的路径，不是已观察到手机当前全部使用。Legacy AppLog 还受自定义配置开关影响。规则只精确拒绝这些 HTTPS 路径，没有整域封 snssdk/zijieapi，也没有伪造 HTTP 200 或业务成功。

AppLog 包含会话/启动、设备关联和事件信息，支持 gzip、TTEncrypt/二进制与响应解码；成功判定不只看 HTTP 状态。失败可保留 SQLite 队列并增加重试计数。Slardar 有磁盘/内存补报及服务端域名重定向。拒绝可能增加缓存、重试和耗电，这不是无副作用的静默删除。

这些路径可被其他字节系 App 共用，QX URL 规则不按 App 进程隔离，影响范围不限前台抖音。保持同域 device_register、log_settings、app_alert_check、用户 dislike/report/个性化设置不匹配；发布前也核对聚合后的域名拒绝集没有反向整域拦截这些九个内容/日志主机。

四个 URL 分组的完整证据标识、范围与风险见 [遥测元数据](curated/douyin-telemetry.json)。目前不默认扩大到：

- Slardar `/monitor/collect/batch/`：网络路径已确认，最终 host 及动态配置未闭合；监控埋点标签不当作真实目的地址。
- 开屏 ack、库存报告和 feed ack_action：已有部分链路，但失败反馈、EventBus 或协议/主机存在剩余边界。
- 任意第三方广告点击/曝光 tracker：广告事件存在主链与动态 URL 并行提交，不等于四条日志规则全包住。

## 手机验收与回退

已添加自有订阅时，更新 Own-App-Ads 重写资源即可取到新配置；过滤资源可一并刷新。首次仍须开启重写/MITM并安装信任自己的证书。旧同范围脚本应停用，避免竞争。不要更换机场或上传原个人配置。

应分别核对开屏、连续推荐、图文和游戏广告的命中；确认正常游戏视频、登录、私信、评论、播放及购物跳转无异常，观察日志重试。iOS host 或响应 schema 不同、Protobuf/加密、证书固定和 HTTP/3 均可能使规则不命中；本版不会凭静态分析声称已经解决这些限制。

出现问题先停用对应新增规则，不扩大为整个业务网关拒绝。需要进一步适配时，用户可自愿提供经过脱敏的命中记录/响应样本。本轮未采集用户账号、设备凭证或真实 feed。
