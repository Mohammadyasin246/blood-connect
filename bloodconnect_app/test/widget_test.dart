// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';

import 'package:bloodconnect_app/main.dart';

void main() {
  testWidgets('BloodConnect App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const BloodConnectApp());

    // Verify splash screen displays BloodConnect
    expect(find.text('BLOODCONNECT'), findsOneWidget);

    // Settle splash timer
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // Verify Welcome Screen displays
    expect(find.text('Save Lives.\nDonate Blood.'), findsOneWidget);
  });
}
