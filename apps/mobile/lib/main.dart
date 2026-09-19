import 'package:flutter/material.dart';

import 'api.dart';

void main() {
  runApp(const CmsMobileApp());
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
