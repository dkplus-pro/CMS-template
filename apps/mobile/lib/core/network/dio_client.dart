import 'package:dio/dio.dart';

import 'package:cms_mobile/core/config/app_config.dart';
import 'package:cms_mobile/core/error/app_error.dart';
import 'package:cms_mobile/core/network/envelope_interceptor.dart';
import 'package:cms_mobile/core/network/retry_interceptor.dart';

/// 连接超时起步值;壳阶段先定 10s,待真机基线数据后再调。
const Duration kConnectTimeout = Duration(seconds: 10);

/// 接收超时起步值;与连接超时同起步。
const Duration kReceiveTimeout = Duration(seconds: 10);

/// dio 工厂:应用内唯一的 Dio 构造入口(业务代码禁止裸 new Dio)。
///
/// 拦截器装配顺序即管道契约:
/// 1. [RetryInterceptor] — 最先看到传输层失败并重试,重放的原请求会重新走完整链路;
/// 2. [EnvelopeInterceptor] — 解包信封,把各类失败归一为 AppError;
/// 3. [additionalInterceptors] — 追加的业务拦截器(如未来 token 注入),看到的是
///    已解包的 data 与已归一的 AppError。
Dio buildDio(
  AppConfig config, {
  List<Interceptor> additionalInterceptors = const [],
  bool enableRetry = true,
}) {
  final Dio dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: kConnectTimeout,
      receiveTimeout: kReceiveTimeout,
    ),
  );
  if (enableRetry) {
    dio.interceptors.add(RetryInterceptor(dio));
  }
  dio.interceptors.add(const EnvelopeInterceptor());
  dio.interceptors.addAll(additionalInterceptors);
  return dio;
}

/// 统一调用边界:执行 [send],把 dio 的 DioException 解回 [AppError] 抛出。
///
/// 信封拦截器保证到达这里的 DioException.error 已是 AppError(传输层失败也已
/// 归一),此处把 dio 的包装类型还原为业务层唯一错误模型;万一出现未被归一的
/// 裸错误,兜底为网络失败 AppError,保证调用方只需 catch AppError 一种类型。
Future<Response<T>> dioCall<T>(Future<Response<T>> Function() send) async {
  try {
    return await send();
  } on DioException catch (e) {
    final Object? error = e.error;
    if (error is AppError) {
      throw error;
    }
    throw const AppError(code: 0, message: kNetworkErrorMessage);
  }
}
