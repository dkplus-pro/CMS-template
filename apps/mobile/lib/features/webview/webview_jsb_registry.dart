import 'package:cms_mobile/core/hybrid/jsb_methods/device.dart';
import 'package:cms_mobile/core/hybrid/jsb_methods/page.dart';
import 'package:cms_mobile/core/hybrid/jsb_methods/ui.dart';
import 'package:cms_mobile/core/hybrid/jsb_registry.dart';

/// webview 容器加载完成后 native→js 的演示事件名(事件订阅 demo 的默认订阅事件)。
const String kWebViewReadyEvent = 'native.webview.ready';

/// 装配 webview 容器用注册表:device + ui + page 三组全量注册。
/// 重复 method 由 JSBRegistry.registerAll 抛 ArgumentError(装配期即暴露)。
JSBRegistry buildWebViewJSBRegistry({
  required JSBDeviceDependencies device,
  required JSBUIDependencies ui,
  required JSBPageDependencies page,
}) {
  return JSBRegistry()
    ..registerAll(buildDeviceHandlers(device))
    ..registerAll(buildUIHandlers(ui))
    ..registerAll(buildPageHandlers(page));
}
