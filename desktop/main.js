/**
 * reader as a desktop app: each folder opened gets reader's own server
 * (src/server.js), on 127.0.0.1 as the CLI has it, and a window showing it.
 * Closing the window stops its server. There is no port or terminal to know
 * about: File → Open Folder… (⌘O), and the folders opened before.
 *
 *   npm start [-- <dir>]       from desktop/, to run it from the checkout
 *   npm run dist               to build the installer for this platform
 */

import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { createServer, listenFrames } from '../src/server.js';
import { load, save, ports, remember, forget } from './folders.js';

const DOCS = 'https://jzheaux.github.io/reader/';
const RELEASES = 'https://github.com/jzheaux/reader/releases';

const settings = () => path.join(app.getPath('userData'), 'folders.json');

// dir → { win, server, origin }
const open = new Map();

function isDir(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

// Each port reader might ask for, in turn, until one is free.
function listen(server, candidates) {
  return new Promise((resolve, reject) => {
    const next = () => {
      const { value: port, done } = candidates.next();
      if (done) return fail(new Error('no port is free'));
      server.listen(port, '127.0.0.1');
    };
    const onError = (err) => (err.code === 'EADDRINUSE' ? next() : fail(err));
    const fail = (err) => {
      server.off('error', onError);
      reject(err);
    };
    server.on('error', onError);
    server.once('listening', () => {
      server.off('error', onError);
      resolve(server.address().port);
    });
    next();
  });
}

// A window's server outlives it a moment, for the save a page sends as it
// closes; quitting waits for them.
const GRACE = 1000;
const stopping = new Set();

function stop(server) {
  const done = new Promise((resolve) => setTimeout(() => {
    server.close(resolve);
    server.closeIdleConnections();
  }, GRACE));
  stopping.add(done);
  done.then(() => stopping.delete(done));
}

async function openFolder(dir) {
  dir = path.resolve(dir);
  const already = open.get(dir);
  if (already) {
    if (already.win.isMinimized()) already.win.restore();
    already.win.focus();
    return;
  }
  if (!isDir(dir)) {
    dialog.showErrorBox('Reader', `There's no folder at ${dir} any more.`);
    save(settings(), forget(load(settings()), dir));
    buildMenu();
    return;
  }

  const made = createServer({ root: dir });
  const { server } = made;
  let port;
  try {
    port = await listen(server, ports(load(settings()), dir));
    // The frames are frames.localhost on the folder's own port, which
    // Electron, as Chromium, takes as this machine; their second port is
    // only where the name can't be had, so any free one does.
    await listenFrames(made);
  } catch (err) {
    if (server.listening) server.close();
    dialog.showErrorBox('Reader', `Couldn't open ${dir}: ${err.message}`);
    return;
  }
  save(settings(), remember(load(settings()), dir, port));
  app.addRecentDocument(dir);

  const origin = `http://127.0.0.1:${port}`;
  const win = new BrowserWindow({ width: 1400, height: 900, show: false, title: path.basename(dir) });
  open.set(dir, { win, server, origin });
  win.once('ready-to-show', () => win.show());
  // Edits not yet saved: the page has sent them off as it goes, and asks to
  // stay, which a browser would put to the user and Electron would just do.
  win.webContents.on('will-prevent-unload', (e) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Close', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      message: 'Close this window?',
      detail: 'Some edits may not have been saved yet.',
    });
    if (choice === 0) e.preventDefault();
  });
  win.on('closed', () => {
    open.delete(dir);
    stop(server);
  });
  win.loadURL(`${origin}/`);
  buildMenu();
}

async function chooseFolder() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open a folder in Reader',
    message: 'Choose the folder your documents are in, or make a new one.',
    buttonLabel: 'Open',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (!canceled && filePaths.length) await openFolder(filePaths[0]);
  return !canceled;
}

// Reader's own pages stay in its windows (the speaker view among them);
// anything else, a scripture link say, opens in the browser.
const ours = (url) => [...open.values()].some(({ origin }) => url === origin || url.startsWith(`${origin}/`));
const external = (url) => /^(https?|mailto):/i.test(url);

app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (ours(url)) return { action: 'allow' };
    if (external(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (e, url) => {
    if (ours(url)) return;
    e.preventDefault();
    if (external(url)) shell.openExternal(url);
  });
});

function buildMenu() {
  const mac = process.platform === 'darwin';
  const recent = load(settings()).folders;
  const focused = () => [...open.entries()].find(([, { win }]) => win === BrowserWindow.getFocusedWindow())?.[0];
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+O', click: () => chooseFolder() },
        {
          label: 'Open Recent',
          submenu: [
            ...recent.map((f) => ({ label: f.path, click: () => openFolder(f.path) })),
            ...(recent.length ? [{ type: 'separator' }] : []),
            {
              label: 'Clear Menu',
              enabled: recent.length > 0,
              click: () => {
                save(settings(), forget(load(settings())));
                app.clearRecentDocuments();
                buildMenu();
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: mac ? 'Show Folder in Finder' : 'Show Folder',
          click: () => focused() && shell.openPath(focused()),
        },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Reader Help', click: () => shell.openExternal(DOCS) },
        { label: 'Release Notes', click: () => shell.openExternal(`${RELEASES}/tag/v${app.getVersion()}`) },
      ],
    },
  ]));
}

// The folder named on the command line, as Windows' "Open with" and a
// shortcut give it; in a checkout, after `electron main.js`. The flags go
// first: a second instance's argv has Chromium's before the app's path.
function folderIn(argv, cwd = process.cwd()) {
  const args = argv.filter((a) => !a.startsWith('-')).slice(app.isPackaged ? 1 : 2);
  return args.map((a) => path.resolve(cwd, a)).find(isDir);
}

// Opening the app again opens the folder it was given in this one.
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_, argv, cwd) => {
    const dir = folderIn(argv, cwd);
    if (dir) openFolder(dir);
    else if (open.size) [...open.values()][0].win.focus();
    else chooseFolder();
  });

  // macOS: a folder dropped on the Dock icon, or picked from its recent
  // list; one given as the app starts is the one it starts with.
  let given;
  app.on('open-file', (e, file) => {
    e.preventDefault();
    if (app.isReady()) openFolder(file);
    else given = file;
  });

  app.whenReady().then(async () => {
    buildMenu();
    const dir = given ?? folderIn(process.argv) ?? load(settings()).folders.map((f) => f.path).find(isDir);
    if (dir) await openFolder(dir);
    else if (!open.size && !(await chooseFolder()) && process.platform !== 'darwin') app.quit();
  });

  // macOS keeps an app running with no windows; clicking it again asks for a folder.
  app.on('activate', () => {
    if (!open.size) chooseFolder();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('will-quit', (e) => {
    if (!stopping.size) return;
    e.preventDefault();
    Promise.all(stopping).then(() => app.quit());
  });
}
