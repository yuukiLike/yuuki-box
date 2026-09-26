import { mountWorkbench } from '../../shared/web/src/workbench-view.jsx';

mountWorkbench({
  title: 'React + WKWebView',
  subtitle: 'ReactDOM / 系统 WebKit · 独立 Swift Agent runtime · 原生能力桥',
  send: (command) => window.webkit.messageHandlers.yuuki.postMessage(command),
  subscribe: (receive) => { window.yuukiReceive = receive; }
});
