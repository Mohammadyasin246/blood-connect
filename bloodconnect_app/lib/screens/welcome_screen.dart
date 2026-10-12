import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'login_screen.dart';
import 'admin_login_screen.dart';
import 'register_screen.dart';
import 'create_request_screen.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top Bar with Special Admin Access Link
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppTheme.bloodPrimary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text('🩸', style: TextStyle(fontSize: 16)),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'BloodConnect',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  TextButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const AdminLoginScreen()),
                      );
                    },
                    icon: const Icon(Icons.security, size: 16, color: AppTheme.bloodLight),
                    label: const Text(
                      'Admin Portal',
                      style: TextStyle(color: AppTheme.bloodLight, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    style: TextButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.05),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 36),

              // Hero Illustration / Icon
              Center(
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: AppTheme.bloodPrimary.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppTheme.bloodPrimary.withValues(alpha: 0.4), width: 1.5),
                  ),
                  child: const Center(
                    child: Text('🩸', style: TextStyle(fontSize: 44)),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Hero Title
              const Text(
                'Save Lives.\nDonate Blood.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Direct connection between voluntary blood donors and emergency patients nearby.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  color: AppTheme.textMuted,
                  height: 1.4,
                ),
              ),

              const SizedBox(height: 32),

              // Emergency Blood Request Button
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const CreateRequestScreen(isEmergency: true)),
                  );
                },
                icon: const Text('🚨', style: TextStyle(fontSize: 18)),
                label: const Text('EMERGENCY BLOOD REQUEST'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFDC2626),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  elevation: 8,
                ),
              ),

              const SizedBox(height: 16),

              // Login Button
              ElevatedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  );
                },
                child: const Text('Login to Account'),
              ),

              const SizedBox(height: 12),

              // Create Account Button
              OutlinedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const RegisterScreen()),
                  );
                },
                child: const Text('Create New Account'),
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
