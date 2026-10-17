# 显示线程优先级工作项独占修复

## 根因与改动

`msm_drm_display_thread_create()` 将同一个 `priv->thread_priority_work` 排入多个 commit/event worker。`kthread_work` 记录所属 worker，跨 worker 复用违反工作项归属要求，可触发 WARN 或漏掉线程优先级初始化。

仅修改 `techpack/display/msm/msm_drv.c` 和 `msm_drv.h`：每个 `msm_drm_thread` 内嵌并初始化自己的 `thread_priority_work`，分别入队到对应 worker；原私有工作项继续供 `pp_event` 使用。回调、SCHED_FIFO/16、线程创建顺序、错误处理和退出清理逻辑保持原样。

## 已完成验证

- 构建基线为 `d8f86ccac75eb4f01dd21c8e9dcbd3129032dac6`；提交前仓库 HEAD 为 `be10dbfbc75e0a39b9d064a1f9c65cbd7a51005d`，两者仅 README 不同。
- Ubuntu Clang/LLD 17.0.6 编译 Image 成功；配置与原基线一致，SHA-256 为 `385688b1c668b670a4686490cd4138671abb813389b591563e32f97ebd4214de`，最终配置以该哈希为准。
- checkpatch 为 0 errors / 0 warnings。提取真实驱动函数的 612 组主机回归及 ASan/UBSan 通过；API 桩验证不替代硬件并发验证。
- 用户授权后在 mars / M2102K1AC / Android 17 / OS4.0.0.19.XKACNXM / slot a 执行 `fastboot boot`，测试内核为 `5.4.302-Dynamic-gd8f86cc-dispfix-test`。
- Image SHA-256 为 `f9f2f8af40d821f28f130b5d3498b3c0b0fea30f4e863564c369b25fcce0a823`；临时 boot 镜像 SHA-256 为 `8765d70bf3fc4b77965ad1c8aab7742924a534f70f6fbf7d7854a661097cc455`。
- 第一轮 5 次、第二轮 10 次熄屏/唤醒通过；两轮各 120 秒 SystemUI 进程观察稳定。2 个 commit、2 个 event 和 1 个 pp_event 线程均为 SCHED_FIFO/16。
- 保留的启动和环形日志未发现原工作项 WARN、Oops、BUG、panic、lockup 或指定显示超时，taint=0；42 项 epoll ABI/信号检查通过，手机配置匹配构建配置。
- boot_a、boot_b、vendor_boot_a、dtbo_a、vbmeta_a 的哈希前后一致；模块开关保留，没有执行分区 flash。

## 验证边界

用户未逐项确认锁屏、触控、相机、声音及 60/120Hz 切换；“没注意到”不记为人工验收全部通过。日志保留范围有限，短时自动测试不证明长期稳定性。既有 271 条 vendor 模块 CRC 拒绝未纳入本次修复。

上述 Image 是提交前的测试产物，不能作为本次新提交哈希对应的正式产物。本次只提交源码和记录，不重编译、不生成 AK3、不发布 Release、不重启手机。后续正式发布必须从最终提交重新构建并按工作规则验收。

本地证据目录：`release-work/20261017-display-work-fix/`，包括 `build-result.json`、`TEST-RESULT.md`、`ROUND2-RESULT.md` 和第二轮逐项证据。
