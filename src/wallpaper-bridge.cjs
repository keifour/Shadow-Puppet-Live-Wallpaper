const messages = {
  EXPLORER_UNAVAILABLE: 'Windows 桌面尚未就绪。请确认资源管理器正在运行后重试。',
  DESKTOP_HOST_UNAVAILABLE: '未找到兼容的 Windows 桌面图层。请重启资源管理器后重试；仍失败时可继续使用窗口预览。',
  ACCESS_DENIED: 'Windows 拒绝了桌面挂载。请以普通用户运行应用，与资源管理器保持相同权限。',
  WINDOW_UNAVAILABLE: '应用或桌面窗口已失效，请重启应用后重试。',
  RESTORE_FAILED: '桌面挂载失败且窗口未能完整恢复，请退出并重新启动应用。',
  ALREADY_ATTACHED: '窗口仍处于桌面模式，请先从托盘恢复控制台或重启应用。'
};
function parseHelperResult(stdout, error) {
  let result;
  try { result = JSON.parse(String(stdout).replace(/^\uFEFF/, '').trim()); } catch {
    throw new Error(error?.killed ? '桌面助手响应超时，请稍后重试。' : '桌面助手未返回有效结果，请重启应用后重试。');
  }
  if (!result || result.ok !== true || error) {
    const code = result?.code || 'HELPER_FAILED';
    const failure = new Error(messages[code] || `Windows 桌面操作失败（${code}），请重试或使用窗口预览。`);
    failure.code = code; throw failure;
  }
  if (!['classic', 'raised', 'window'].includes(result.mode)) throw new Error('桌面助手返回了未知的挂载模式。');
  return result;
}
module.exports = { parseHelperResult };
