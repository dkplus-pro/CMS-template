import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'home_providers.dart';

/// ping 页(业务接入范式样板):三态渲染(loading/success/failure),
/// 全部状态来自 pingProvider,页面不持有业务逻辑。
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ping = ref.watch(pingProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('CMS Mobile')),
      body: Center(
        child: switch (ping) {
          AsyncLoading() => const CircularProgressIndicator(),
          AsyncError(:final error) => Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('加载失败:$error'),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => ref.read(pingProvider.notifier).retry(),
                  icon: const Icon(Icons.refresh),
                  label: const Text('重试'),
                ),
              ],
            ),
          AsyncValue(:final value?) => Text(value, style: Theme.of(context).textTheme.titleMedium),
        },
      ),
    );
  }
}
