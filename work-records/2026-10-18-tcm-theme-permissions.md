# 主题管理器 TCM 权限补全与实机验收

## 必要性与范围

mars / Android 17 / OS4.0.0.19.XKACNXM 的主题管理器 `com.android.thememanager` 11.1.7.0 运行在 `theme` 域，实机完整上下文为 `u:r:theme:s0:c512,c768`。修复前保留日志有 117 条 `TcmReceiver` 对 `vendor_dpmtcm_socket` 的 `sock_file write` 拒绝；权限查询还确认连接 `vendor_dpmd` 的 `unix_stream_socket connectto` 被拒绝。

原第 4 项只生成并检查三个原有调用域的写入规则，遗漏主题管理器。修复沿用同一个开关，仅在精确匹配 `.19` ROM 和对应 vendor 指纹时增加：

```text
allow theme vendor_dpmtcm_socket sock_file write;
allow theme vendor_dpmd unix_stream_socket connectto;
```

`.26` 保持原范围。安装时准备、开机规则核对和当前权限检查同步覆盖新增规则；精确兼容新旧自有策略及 RTC 组合，仍拒绝接管未知规则。新安装五个开关默认关闭，升级保留合法选择，TCM 不即时加载策略。模块版本为 `2.6.5-test` / versionCode `15`。

## 验证结果

- 140 项真实脚本函数和安装逻辑的离线回归通过，覆盖精确指纹、缺失权限、查询失败、规则缺失或重复、旧版迁移、TCM/RTC 组合及默认配置；4 个 shell 脚本通过 WSL bash 和 Android sh 语法检查。
- 用户明确授权打包、升级及临时启动后，通过 ksud 安装一次测试包；`fastboot boot` 使用已验证的显示测试镜像，没有写 boot 分区。
- 首次升级开机后有效载荷哈希符合打包清单；theme 的普通及完整上下文 write/connectto 四项查询全部允许，tcm_rule/active/verified 均为 1。
- 主题管理器强制停止后冷启动成功，TotalTime 404 ms；自动上滑、下滑、返回、再次调用无错误。再次调用复用顶层 Activity，不记为新 Activity 重建验证。
- 连续 120 秒、13 次采样中主题管理器和 SystemUI PID 及 boot ID 不变，未发现主题 crash/lastanr；保留日志中 theme 相关 TCM AVC 拒绝为 0。修复前后日志窗口不等长，不能作为等时性能统计。
- 五个开关、其他模块启用状态、亮度/刷新率设置保留；boot_a、boot_b、vendor_boot_a、dtbo_a、vbmeta_a 哈希一致。运行内核仍为 `5.4.302-Dynamic-gd8f86cc-dispfix-test`，SELinux Enforcing，taint=0。

## 未解决问题与验收边界

**TCM 端到端连接未通过。** `/dev/socket/tcm` 在升级前后均未监听；升级后 `ss` 显示 UNCONN，dpmd 父子进程持有该 Socket。新启动的主题客户端仍提示 `Couldn't find 'tcm' socket after 120times. quit trying`。`/dev/socket/dpmd` 的监听不能替代 tcm 的监听。

本次确认的是权限缺口修复和对应 AVC 消失，不是服务端监听或全部重试问题修复。没有修改 vendor 服务配置、属性、Socket 文件权限或其他调用域授权；原三域的完整连接也不在本次验收范围。未应用、购买或下载主题，未进行人工功能、长期续航或深度休眠验收；只验证一次升级后的首次开机加载。

本次启动还可见 ROM init/qti-testscripts 的 setexeccon Invalid argument，未认定为本模块回归或擅自修复。本记录不声称全机日志无错误。

测试包 SHA-256：`f9aedadcf8c8b6eb1c6541eb3d5b6658901cfcbc738d64c0ce3ae6df500ec9db`。该包来自提交前源码；README 在提交前补充了实机结论，未重新打包或升级手机。本次提交不构成 Release，后续正式产物须由最终标签源码重新生成并验收。

本地证据目录：`module-work/20261018-tcm-theme-fix/`，包含源码基线、140 项回归、安装和首次开机核对、`DEVICE-RESULT.md`、截图及 `theme-automatic-verification.json`；原模块备份已保留。
