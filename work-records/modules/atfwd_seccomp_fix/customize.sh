#!/system/bin/sh
[ "$(getprop ro.product.device)" = mars ] || abort '本模块仅在小米 11 Pro（mars）验证。'
[ "$(getprop ro.build.version.release)" = 17 ] || abort '本版本仅适配 Android 17。'
ui_print '安装系统服务稳定性修复：ATFWD、traced、GNSS、TCM、RTC 分别控制。'
# 更新同一模块时保留用户选择；不执行或导入配置文件中的任何命令。
for feature in atfwd traced gnss tcm suspend; do
    old="/data/adb/modules/atfwd_seccomp_fix/config/${feature}_enabled"
    if [ -f "$old" ]; then
        value=$(cat "$old")
        case "$value" in 0|1) printf '%s\n' "$value" > "$MODPATH/config/${feature}_enabled" ;; esac
    fi
done
set_perm_recursive "$MODPATH" 0 0 0755 0644
for script in control.sh post-fs-data.sh service.sh customize.sh; do
    set_perm "$MODPATH/$script" 0 0 0755
done
# 策略标签必须与 vendor 原文件一致，避免再次触发已确认的读取失败。
chcon -R u:object_r:vendor_configs_file:s0 "$MODPATH/system/vendor" || abort '设置 vendor 策略标签失败。'
ui_print '新安装 ATFWD、traced 默认开启，GNSS、TCM、RTC 默认关闭；升级保留原选择。'
ui_print 'GNSS 开启仅抑制缺失 AIDL 的请求，仍需实机定位验收。'
