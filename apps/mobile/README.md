# apps/mobile — CMS 手机端(Flutter 占位工程)

CMS 的 Flutter 手机端占位工程(hello-world 阶段),消费公开契约 [`openapi/app/openapi.yaml`](../../openapi/app/openapi.yaml) 的 `GET /api/app/ping`:启动时请求该端点,解析信封 `{code, message, data}` 并把 `data.message`(`pong from app api`)渲染到首页;失败时降级展示错误信息。

占坑期为手写请求(`lib/api.dart`),dart 侧 OpenAPI 生成链列入后续阶段。

## 前置要求

- Flutter SDK(stable 渠道,建议最新版;`flutter_lints` 最新版要求 Dart ≥ 3.8)。

## 首次初始化:补齐平台脚手架

本仓库为保持精简,**未提交 android/ios 等平台目录**,仅手工维护 `pubspec.yaml` + `lib/` + `test/`。首次在装有 Flutter SDK 的环境执行一次:

```bash
cd apps/mobile
flutter create . --platforms=android,ios
```

该命令只补齐缺失的平台脚手架(android/ios 等),不会覆盖已有的 `lib/` 与 `test/`。

## 本地运行

1. 启动后端(Go server,默认 18085):仓库根 `pnpm dev`,或参见 `apps/server`;
2. 运行 App:

```bash
flutter pub get
flutter run
```

默认请求 `http://localhost:18085/api/app/ping`(见 `lib/api.dart` 的 `defaultBaseUrl`)。

**Android 模拟器**内 `localhost` 指向模拟器自身,需把 `lib/api.dart` 的 `defaultBaseUrl` 改为 `http://10.0.2.2:18085`。

## 测试与静态检查

```bash
flutter analyze
flutter test
```

CI(subosito/flutter-action,stable)同样执行 `flutter analyze && flutter test` 作为本工程的验收门禁。单测 `test/api_test.dart` 为纯 Dart 用例(只测信封解析,不发网络、不 pump widget),不依赖模拟器。

## 目录说明

```
lib/api.dart       # ping 请求 + 信封解析(defaultBaseUrl 常量、parsePingMessage 纯函数)
lib/main.dart      # MaterialApp hello world(loading / message / 失败 三态)
test/api_test.dart # parsePingMessage 边界单测(正常/空串/缺字段/非法 JSON 等)
```
