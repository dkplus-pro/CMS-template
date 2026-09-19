import 'dart:convert';

import 'package:http/http.dart' as http;

/// 本地开发默认后端地址(Go server,见 apps/server)。
///
/// 注意:Android 模拟器内 `localhost` 指向模拟器自身,
/// 访问宿主机需改为 `http://10.0.2.2:18085`(详见 README)。
const String defaultBaseUrl = 'http://localhost:18085';

/// 调用 `GET {baseUrl}/api/app/ping`(契约见 openapi/app/openapi.yaml),
/// 解析信封 `{code, message, data}` 并返回 `data.message`。
///
/// 网络错误、非 200、响应体不符合信封约定时抛出异常。
Future<String> fetchPingMessage({required String baseUrl}) async {
  final http.Response response = await http.get(
    Uri.parse('$baseUrl/api/app/ping'),
  );

  if (response.statusCode != 200) {
    throw Exception('GET /api/app/ping failed with HTTP ${response.statusCode}');
  }

  return parsePingMessage(response.body);
}

/// 从 ping 响应信封中解析 `data.message`(纯函数,便于单测)。
///
/// 期望结构:`{"code": 0, "message": "...", "data": {"message": "..."}}`。
/// 非法 JSON、信封非对象、缺 `data`、`data.message` 缺失或非字符串
/// 均抛 [FormatException](`data.message` 为空串视为合法,原样返回)。
String parsePingMessage(String body) {
  // jsonDecode 对非法 JSON 自身抛 FormatException,直接透传。
  final Object? decoded = jsonDecode(body);

  if (decoded is! Map<String, dynamic>) {
    throw const FormatException('ping response envelope is not a JSON object');
  }

  final Object? data = decoded['data'];
  if (data is! Map<String, dynamic>) {
    throw const FormatException('ping response envelope misses a "data" object');
  }

  final Object? message = data['message'];
  if (message is! String) {
    throw const FormatException('ping response "data.message" is not a string');
  }

  return message;
}
