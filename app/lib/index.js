'use strict';

const windowStateKeeper = require('electron-window-state');
const path = require('path');
const { shell, app, ipcMain, remote, BrowserWindow } = require('electron');
const configBuilder = require('./config');
const NativeNotification = require('electron-native-notification');

const DEFAULT_WINDOW_WIDTH = 0;
const DEFAULT_WINDOW_HEIGHT = 0;

const Menus = require('./menus');

let menus;


function createWindow(iconPath) {
  // Load the previous state with fallback to defaults
  let windowState = windowStateKeeper({
    defaultWidth: DEFAULT_WINDOW_WIDTH,
    defaultHeight: DEFAULT_WINDOW_HEIGHT
  });

  // Create the window
  const window = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,

    width: windowState.width,
    height: windowState.height,

    show: false,
    iconPath,
    autoHideMenuBar: false,
    icon: path.join(__dirname, 'assets', 'icons', 'icon-96x96.png'),

    webPreferences: {
      partition: 'persist:teams',
      preload: path.join(__dirname, 'browser', 'index.js'),
      nativeWindowOpen: true,
      safeDialogs: true,
      plugins: true,
      nodeIntegration: false,
    }
  });

  windowState.manage(window);
  window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
  }

  return window;
}

app.commandLine.appendSwitch('auth-server-whitelist','*');
app.commandLine.appendSwitch('enable-ntlm-v2','true');

app.on('ready', () => {

  const iconPath = path.join(
    app.getAppPath(),
    'lib/assets/icons/icon-96x96.png'
  );
  const window = createWindow(iconPath);
  const config = configBuilder(app.getPath('userData'));

  menus = new Menus(config, iconPath);
  menus.register(window);

  window.on('page-title-updated', (event, title) =>
    window.webContents.send('page-title', title)
  );

  ipcMain.on('nativeNotificationClick', event => {
    console.log('nativeNotificationClick called');
    window.show();
    window.focus();
  });

  ipcMain.on('notifications', async (e, msg) => {
    if (msg.count>0){  
      const body = "You got " + msg.count + " notification(s). " + ((msg.text) ? " <i>" + msg.text + "</i> " : "");    
      const notification = new NativeNotification(
        "Microsoft Teams", 
        {
          "body": body,
          "icon": iconPath,
         });
      if (notification.show !== undefined) {
        notification.show();
      } 
    }
  });

  window.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  window.webContents.on('login', (event, request, authInfo, callback) => {
    event.preventDefault();
    loginService(callback);
  });

  if (config.userAgent === 'edge') {
    window.webContents.setUserAgent(config.edgeUserAgent);
  } else {
    window.webContents.setUserAgent(config.chromeUserAgent);
  }
  
  window.once('ready-to-show', () => window.show());

  window.webContents.on('did-finish-load', function() {
    window.webContents.insertCSS('#download-mobile-app-button, #download-app-button, #get-app-button { display:none; }');
    window.webContents.insertCSS('.zoetrope { animation-iteration-count: 1 !important; }');
  });

  window.on('closed', () => window = null);

  window.loadURL(config.url)
  // loginService((username, password) => {
  //   window.loadURL(config.url)
  // });
});

app.on('login', function (event, webContents, request, authInfo, callback) {
  if (typeof config !== 'undefined' && typeof config.firewallUsername !== 'undefined') {
    callback(config.firewallUsername, config.firewallPassword);
  }
  
});


function loginService(callback) {
  const win = new BrowserWindow({
    width: 363,
    height: 124,
    frame: false,
    preload: path.join(__dirname, 'login', 'index.js'),

    show: false,
    autoHideMenuBar: true,
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  ipcMain.on('submitForm', function(event, data) {
    console.log('submitForm called', data);
    callback(data.username, data.password);
    win.close();
  });

  win.loadURL(`file://${__dirname}/login/login.html`);
}