'use strict';
const byId = id => document.getElementById(id);
const toggles = [byId('atfwd-toggle'), byId('traced-toggle'), byId('gnss-toggle'), byId('tcm-toggle'), byId('suspend-toggle')];
let busy = false;
let lastState;

function message(text, error = false) {
  byId('message').textContent = text;
  byId('message').classList.toggle('error', error);
}
function disableControls(disabled) {
  toggles.forEach(toggle => { toggle.disabled = disabled; });
  byId('refresh').disabled = disabled;
}
function serviceText(state, pid) {
  const words = { running:'运行中', restarting:'反复重启', stopped:'已停止', stopping:'正在停止' };
  return `${words[state] || state || '未知'}${pid ? ` · PID ${pid}` : ''}`;
}
function paint(id, text, good) {
  const node = byId(id);
  node.textContent = text;
  node.classList.toggle('good', good);
  node.classList.toggle('warn', !good);
}
function render(state) {
  lastState = state;
  byId('atfwd-toggle').checked = state.atfwd_enabled === '1';
  byId('traced-toggle').checked = state.traced_enabled === '1';
  byId('gnss-toggle').checked = state.gnss_enabled === '1';
  byId('tcm-toggle').checked = state.tcm_enabled === '1';
  byId('suspend-toggle').checked = state.suspend_enabled === '1';
  ['atfwd', 'traced', 'gnss', 'tcm', 'suspend'].forEach(feature => {
    const node = byId(`${feature}-advice`);
    const wasHidden = node.hidden;
    node.hidden = state[`${feature}_enabled`] === '1';
    if (!node.hidden && (wasHidden || !node.textContent)) node.textContent = '正在检查对应错误日志…';
  });
  paint('atfwd-active', state.atfwd_active === '1' ? '已放行 gettid' : 'ROM 原策略', state.atfwd_active === '1');
  paint('atfwd-service', serviceText(state.atfwd_service, state.atfwd_pid), state.atfwd_service === 'running');
  byId('atfwd-pending').hidden = state.atfwd_enabled === state.atfwd_active;
  paint('traced-active', state.relay ? 'ROM 虚拟机通道' : '本地通道', !state.relay);
  paint('traced-service', serviceText(state.traced_service, state.traced_pid), state.traced_service === 'running');
  byId('traced-pending').hidden = (state.traced_enabled === '1') === !state.relay;
  paint('gnss-active', state.gnss_active === '1' ? '异常请求已停止' : state.gnss_enabled === '0' ? '未启用处理' : '未确认生效', state.gnss_active === '1');
  paint('gnss-aux-service', serviceText(state.gnss_aux_service, state.gnss_aux_pid), state.gnss_aux_service === 'stopped');
  paint('gnss-service', serviceText(state.gnss_service, state.gnss_pid), state.gnss_service === 'running');
  byId('gnss-skip').textContent = state.gnss_skip || '未设置 / 空值';
  byId('gnss-pending').hidden = state.gnss_enabled === state.gnss_active;
  paint('tcm-rule', state.tcm_active === '1' ? '当前已加载' : state.tcm_rule === '1' ? '已准备，下次开机加载' : '未准备，使用 ROM 原策略', state.tcm_active === '1');
  byId('tcm-pending').hidden = state.tcm_enabled === state.tcm_active;
  paint('suspend-rule', state.suspend_active === '1' ? '当前已加载' : state.suspend_rule === '1' ? '已准备，下次开机加载' : '未准备，使用 ROM 原策略', state.suspend_active === '1');
  byId('suspend-pending').hidden = state.suspend_enabled === state.suspend_active;
  byId('device').textContent = `${state.device} · Android ${state.android}`;
  ['rom', 'kernel', 'relay'].forEach(key => { byId(key).textContent = state[key] || '未设置'; });
  byId('master').textContent = state.traced_master === '1' ? '已开启' : `当前值：${state.traced_master || '未设置'}`;
  byId('probes').textContent = serviceText(state.traced_probes);
  byId('checked').textContent = `更新于 ${state.checked}`;
}
async function refresh() {
  const output = await exec(`${CONTROL} status`);
  const state = {};
  output.trim().split('\n').forEach(line => {
    const index = line.indexOf('=');
    if (index >= 0) state[line.slice(0, index)] = line.slice(index + 1).trim();
  });
  if (!['0', '1'].includes(state.atfwd_enabled) || !['0', '1'].includes(state.traced_enabled) || !['0', '1'].includes(state.gnss_enabled) || !['0', '1'].includes(state.tcm_enabled) || !['0', '1'].includes(state.suspend_enabled)) {
    throw new Error('模块状态格式异常，开关已暂停。');
  }
  render(state);
  await checkAdvice(state);
  byId('logs').textContent = (await exec(`${CONTROL} logs`)).trim() || '暂无操作记录';
}
async function checkAdvice(state) {
  const disabled = ['atfwd', 'traced', 'gnss', 'tcm', 'suspend'].filter(feature => state[`${feature}_enabled`] === '0');
  if (!disabled.length) return;
  try {
    const output = await exec(`${CONTROL} diagnostics`);
    const values = Object.fromEntries(output.trim().split('\n').map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).trim()];
    }));
    disabled.forEach(feature => {
      const count = values[`${feature}_errors`];
      if (!/^\d+$/.test(count || '')) throw new Error('日志检查结果异常');
    });
    disabled.forEach(feature => {
      const count = Number(values[`${feature}_errors`]);
      let advice = count > 0
        ? `发现 ${count} 条对应错误，建议开启此项处理。`
        : '未发现对应错误，暂时无需开启。';
      if (!count && state[`${feature}_active`] === '1') {
        advice = '未发现对应错误，但当前处理仍在生效；待关闭实际生效后再刷新判断。';
      }
      byId(`${feature}-advice`).textContent = `${advice} 检查范围：最近 5 分钟内最多 2000 条相关日志（${values.diagnostics_checked || '本次刷新'}）。日志可能被覆盖，未发现不代表从未发生。`;
    });
  } catch (error) {
    disabled.forEach(feature => {
      byId(`${feature}-advice`).textContent = `无法判断：${error.message}。请刷新重试，不能据此认为无需开启。`;
    });
  }
}
function confirmOff(feature) {
  const dialog = byId('confirm-dialog');
  const warnings = {
    atfwd: '下次开机将不再放行 gettid，ATFWD 可能恢复崩溃重启。当前服务不受本次切换影响。',
    traced: '将立即恢复 ROM 的 vsock 配置并重启 traced，原来的重启循环可能再次出现。本地性能追踪可能不可用。',
    gnss: '将恢复本次开机的原跳过属性和辅助服务状态，不存在的 GNSS AIDL 接口请求可能再次出现。原有 HIDL 定位服务保持运行。',
    tcm: '将移除本模块的 TCM Socket SELinux 规则，下次开机后原来的 TcmReceiver 拒绝日志可能再次出现。',
    suspend: '将移除下次开机的 system_suspend RTC 读取规则；当前开机已加载的规则需重启后撤销。'
  };
  byId('confirm-text').textContent = warnings[feature];
  return new Promise(resolve => {
    dialog.returnValue = 'cancel';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once:true });
    dialog.showModal();
  });
}
async function setFeature(feature, value) {
  if (busy) return;
  busy = true;
  disableControls(true);
  try {
    if (!value && !await confirmOff(feature)) { render(lastState); return; }
    message('正在保存并应用选择…');
    // 功能名来自固定事件绑定；数值仅由复选框转换为 0 或 1。
    const result = await exec(`${CONTROL} set ${feature} ${value ? '1' : '0'}`);
    if (feature === 'traced') await new Promise(resolve => setTimeout(resolve, 1200));
    await refresh();
    message(result.trim());
  } catch (error) {
    // 后端可能已保存选择但应用失败，重新读取以免页面显示旧开关。
    try { await refresh(); } catch (_) { if (lastState) render(lastState); }
    message(`操作未完成：${error.message}`, true);
  } finally { busy = false; disableControls(!lastState); }
}
byId('atfwd-toggle').addEventListener('change', event => setFeature('atfwd', event.target.checked));
byId('traced-toggle').addEventListener('change', event => setFeature('traced', event.target.checked));
byId('gnss-toggle').addEventListener('change', event => setFeature('gnss', event.target.checked));
byId('tcm-toggle').addEventListener('change', event => setFeature('tcm', event.target.checked));
byId('suspend-toggle').addEventListener('change', event => setFeature('suspend', event.target.checked));
byId('refresh').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  disableControls(true);
  try { await refresh(); message('已读取当前状态。开关彼此独立，页面不会自动重启手机。'); }
  catch (error) { message(`读取失败：${error.message}`, true); }
  finally { busy = false; disableControls(!lastState); }
});
if (!window.ksu || typeof window.ksu.exec !== 'function') {
  message('请从 KernelSU 管理器中打开本模块的 WebUI，普通浏览器无法控制手机。', true);
  disableControls(true);
} else {
  byId('refresh').click();
}
