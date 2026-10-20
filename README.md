# 自有 Quantumult X 去广告源

这是自己维护、AI 审查后发布的激进去广告源。“广告零容忍”是维护策略，不是所有 App 永久零广告的保证。当前为首次测试发布，尚未经过 iPhone 真机验证。

## 手机安装

[一键添加自己的去广告订阅](https://quantumult.app/x/open-app/add-resource?remote-resource=%7B%22filter_remote%22%3A%5B%22https%3A%2F%2Fraw.githubusercontent.com%2F724-cyber%2Fquantumultx-app-adblock%2Fmain%2Fdist%2Freject.list%2C%20tag%3DOwn-Adblock%2C%20force-policy%3Dreject%2C%20update-interval%3D86400%2C%20opt-parser%3Dfalse%2C%20enabled%3Dtrue%22%5D%2C%22rewrite_remote%22%3A%5B%22https%3A%2F%2Fraw.githubusercontent.com%2F724-cyber%2Fquantumultx-app-adblock%2Fmain%2Fdist%2Frewrite.snippet%2C%20tag%3DOwn-App-Ads%2C%20update-interval%3D86400%2C%20opt-parser%3Dfalse%2C%20enabled%3Dtrue%22%5D%7D)

这个入口一次添加本仓库的分流和重写资源，保留机场资源与现有证书。手机只使用本仓库发布的规则及固定哈希 JS，不直接跟随上游源，不执行上游可变 JS。

Universal Link 没有唤起 QX 时，可复制原生地址：

~~~text
quantumult-x:///add-resource?remote-resource=%7B%22filter_remote%22%3A%5B%22https%3A%2F%2Fraw.githubusercontent.com%2F724-cyber%2Fquantumultx-app-adblock%2Fmain%2Fdist%2Freject.list%2C%20tag%3DOwn-Adblock%2C%20force-policy%3Dreject%2C%20update-interval%3D86400%2C%20opt-parser%3Dfalse%2C%20enabled%3Dtrue%22%5D%2C%22rewrite_remote%22%3A%5B%22https%3A%2F%2Fraw.githubusercontent.com%2F724-cyber%2Fquantumultx-app-adblock%2Fmain%2Fdist%2Frewrite.snippet%2C%20tag%3DOwn-App-Ads%2C%20update-interval%3D86400%2C%20opt-parser%3Dfalse%2C%20enabled%3Dtrue%22%5D%7D
~~~

首次需要自己安装并完全信任 MITM 证书，开启重写和 MITM。已有证书可继续使用。证书、机场和个人配置不包含在仓库中。

导入后应停用旧广告/遥测订阅及同范围本地重写，保留机场和正常分流。一键添加不会替你删除旧资源，尤其不要叠加旧闲鱼/淘宝响应脚本。原配置中的跳过上游证书校验设置也应单独复核。

资源地址（不需要逐条手动添加）：

- [广告与遥测分流](dist/reject.list)
- [App 响应重写](dist/rewrite.snippet)
- [版本与 AI 审查](dist/release.json)
- [来源与许可](dist/SOURCES.md)

## 首版范围

- 三份公共列表的固定快照，规范化、去重并折叠父域覆盖后，当前为 7,641 条原生 QX reject 条件，无需第三方解析器。
- 闲鱼开屏、部分首页/同城列表、四个广告点击曝光与失败补报接口；淘宝商业开屏、搜索/默认推荐中的明确 P4P 商品适配。
- 默认拒绝两个已知阿里 UT 主机和部分通用统计域。它会影响其他 App 使用同主机的统计，并可能触发缓存/重试；不代表关闭全部遥测。
- 部分广告点击域也会被拒绝，广告落地链接可能打不开。不会为保留付费广告自动放行；混合业务主机优先字段过滤，不靠封掉登录/支付来去广告。
- 不包含会员展示伪装、授权激活绕过、安全浏览检查禁用或第三方插件替换，这些不是去广告。

首版有理由排除 54 条有效输入，另有 2 行格式问题单独处理。相同条件合并并保留各来源。历史域名用途变化和未观测误伤仍可能存在；AI 审查是全量结构检查加风险定向分析，不是逐域联网鉴定。App 改写来自特定 Android 样本，iOS 字段、证书固定与缓存还需验证。

## 更新方式

只在你明确要求时更新，不设定时任务。仓库没有云模型密钥、自动收费 API 或自动给自己盖 AI 已审查章的工作流。

每次由 AI 维护者实际执行：

1. 重新下载来源和许可，生成本次 run ID、时间、SHA-256 与待审数据。
2. 审查变化、重复、父域覆盖、异常扩张、非广告功能、许可和脚本，撰写绑定本次输入的审查记录。
3. 通过测试，构建分流/重写/固定哈希 JS，核对发布内容后才提交。
4. 对比线上内容与本地哈希。下载、审查或测试失败则保留上一版，不直接发布上游结果。

手机可自动检查已发布的自有版本；这不是自动接受上游更新。

## 维护命令

需要 Node.js 20 或更新版本，无 npm 第三方依赖。

~~~sh
node cli.cjs fetch
node cli.cjs inspect
# AI 阅读 .work/input.json、.work/inspection.json 与上一版，撰写真正的新审查文件。
node --test test/cli.test.cjs test/pipeline.test.cjs test/curated.test.cjs
node cli.cjs build reviews/current.json
node cli.cjs verify
# 最后才审查 git diff、提交和推送。以上命令不会自行发布。
~~~

缺少审查、新下载批次、来源/许可/脚本/编译器变化、未处理输入或发布字节被修改，都无法通过相应门禁。审查 JSON 是过程记录，不是密码学身份证明；伪造记录不能代替 AI 实际审查。每次新下载都须新审，即使下载字节没变。

脚本按内容哈希命名，更新后保留旧文件，避免手机缓存旧重写时脚本 404。Git 历史保留以前版本。误伤时先停用对应资源，再有证据地收窄规则。

## 来源和许可

首版来源：NobyDa/Script 的 AdRule；w37fhy/QuantumultX 的 Advertising、Tracking。没有重复收录与 Tracking 当前相同的 Hijacking。来源只是候选输入，不因文件名含广告就原样放行。

上游为 GPLv3，保留完整许可、原始快照、来源和变更记录。仅署名不替代许可义务。本项目生成的实现按 GPL-3.0-only 提供，无担保。

参考：[QX 官方导入说明](https://github.com/crossutility/Quantumult-X/blob/master/url-scheme.md)、[QX 官方配置说明](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)。
