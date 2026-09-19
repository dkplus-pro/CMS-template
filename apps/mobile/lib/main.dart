import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';

void main() {
  // 最小装配雏形(M1.3):ProviderScope 先挂上,M3.1 在此追加 overrides
  // (按 AppConfig 选择 core 实现)与 Sentry 条件初始化、runZonedGuarded 收口。
  runApp(const ProviderScope(child: CmsMobileApp()));
}

/// 应用入口:MaterialApp hello world,首页展示 ping 结果。
class CmsMobileApp extends StatelessWidget {
  const CmsMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CMS Mobile',
      home: const PingPage(),
    );
  }
}

/// 首页:启动时调用 `GET /api/app/ping`,渲染 loading / message / 失败 三态。
class PingPage extends StatefulWidget {
  const PingPage({super.key});

  @override
  State<PingPage> createState() => _PingPageState();
}

class _PingPageState extends State<PingPage> {
  bool _loading = true;
  String? _message;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _loadPing();
  }

  Future<void> _loadPing() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final String message = await fetchPingMessage(baseUrl: defaultBaseUrl);
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _message = message;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CMS Mobile')),
      body: Center(child: _buildBody(context)),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const CircularProgressIndicator();
    }

    if (_error != null) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('连接失败,请确认服务端已启动(默认 18085)'),
          const SizedBox(height: 8),
          Text(
            '$_error',
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ],
      );
    }

    return Text(
      _message ?? '',
      style: Theme.of(context).textTheme.headlineSmall,
    );
  }
}
