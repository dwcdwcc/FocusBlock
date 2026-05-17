const SYSTEM_APPS = new Set([
  'electron.exe',
  'explorer.exe',
  'cmd.exe',
  'conhost.exe',
  'windows command processor',
  'windows explorer',
  'shellexperiencehost.exe',
  'shellhost.exe',
  'shellhost',
  'searchhost.exe',
  'searchapp.exe',
  'startmenuexperiencehost.exe',
  'applicationframehost.exe',
  'textinputhost.exe',
  'systemsettings.exe',
  'dwm.exe',
  'sihost.exe',
  'ctfmon.exe',
  'lockapp.exe',
  'taskmgr.exe',
  'windowsterminal.exe',
  'rundll32.exe',
  'fontdrvhost.exe',
  'smartscreen.exe',
  'useroobebroker.exe',
  'wininit.exe',
  'winlogon.exe',
  'csrss.exe',
  'services.exe',
  'svchost.exe',
  'taskhostw.exe',
  'runtimebroker.exe'
]);

function isSystemApp(name) {
  return SYSTEM_APPS.has(String(name || '').trim().toLowerCase());
}

module.exports = { SYSTEM_APPS, isSystemApp };
