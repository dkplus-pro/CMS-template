import 'package:flutter_test/flutter_test.dart';

import 'package:cms_mobile/api.dart';

void main() {
  group('parsePingMessage', () {
    test('正常信封返回 data.message', () {
      const body =
          '{"code":0,"message":"ok","data":{"message":"pong from app api"},"logID":"log-1"}';
      expect(parsePingMessage(body), 'pong from app api');
    });

    test('data.message 为空串视为合法,原样返回', () {
      const body = '{"code":0,"message":"ok","data":{"message":""}}';
      expect(parsePingMessage(body), '');
    });

    test('缺 data 抛 FormatException', () {
      const body = '{"code":0,"message":"ok"}';
      expect(() => parsePingMessage(body), throwsFormatException);
    });

    test('data 不是对象抛 FormatException', () {
      const body = '{"code":0,"message":"ok","data":"pong"}';
      expect(() => parsePingMessage(body), throwsFormatException);
    });

    test('缺 data.message 抛 FormatException', () {
      const body = '{"code":0,"message":"ok","data":{}}';
      expect(() => parsePingMessage(body), throwsFormatException);
    });

    test('data.message 非字符串抛 FormatException', () {
      const body = '{"code":0,"message":"ok","data":{"message":1}}';
      expect(() => parsePingMessage(body), throwsFormatException);
    });

    test('非法 JSON 抛 FormatException', () {
      expect(() => parsePingMessage('not-json'), throwsFormatException);
    });

    test('信封为非对象(数组)抛 FormatException', () {
      expect(() => parsePingMessage('[]'), throwsFormatException);
    });
  });
}
