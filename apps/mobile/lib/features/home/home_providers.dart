import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/network/dio_client.dart';
import '../../core/network/ping_repository.dart';

/// 应用配置 Provider:AppConfig.fromDartDefines() 在 M3.1 装配时经 override 注入测试替身。
final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.fromDartDefines());

/// Dio 实例 Provider:全应用共享(信封/重试拦截器已装配)。
final dioProvider = Provider((ref) => buildDio(ref.watch(appConfigProvider)));

/// Ping 数据源 Provider:测试经 override 注入 Fake。
final pingRepositoryProvider = Provider<PingRepository>(
  (ref) => PingRepository(ref.watch(dioProvider)),
);

/// Ping 页面状态:AsyncNotifier 承载加载/成功/失败三态;
/// 失败时保留 AppError,页面据此渲染重试入口(业务接入范式样板)。
class PingController extends AsyncNotifier<String> {
  @override
  Future<String> build() => ref.read(pingRepositoryProvider).fetchMessage();

  /// 手动重试:重跑 build(重新请求)。
  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(pingRepositoryProvider).fetchMessage());
  }
}

/// 失败态粘滞:关闭 Riverpod 3 的自动重试——重试语义由页面重试按钮(manual retry)承担,
/// 自动重试会把"加载失败"静默吞掉,用户无法感知(见 home_page 三态契约)。
final pingProvider = AsyncNotifierProvider<PingController, String>(
  PingController.new,
  retry: (retryCount, error) => null,
);
