import { mountWorkbench } from '../../shared/web/src/workbench-view.jsx';
import { WebScenes } from './scenes.jsx';

mountWorkbench({
  title: 'React + WKWebView',
  subtitle: 'ReactDOM / 系统 WebKit · 独立 Swift Agent runtime · 原生能力桥',
  Scenes: WebScenes,
  send: (command) => window.webkit.messageHandlers.yuuki.postMessage(command),
  subscribe: (receive) => { window.yuukiReceive = receive; }
});
