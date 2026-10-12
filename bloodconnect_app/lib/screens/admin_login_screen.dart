import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'admin_dashboard_screen.dart';

class AdminLoginScreen extends StatefulWidget {
  const AdminLoginScreen({super.key});

  @override
  State<AdminLoginScreen> createState() => _AdminLoginScreenState();
}

class _AdminLoginScreenState extends State<AdminLoginScreen> {
  final _emailController = TextEditingController(text: 'admin@bloodconnect.org');
  final _keyController = TextEditingController();
  bool _isLoading = false;
  bool _obscureKey = true;

  @override
  void dispose() {
    _emailController.dispose();
    _keyController.dispose();
    super.dispose();
  }

  void _autofillCredentials() {
    _emailController.text = 'admin@bloodconnect.org';
    _keyController.text = 'ADMIN@SECURE#2026';
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Special Master Clearance Key applied.')),
    );
  }

  Future<void> _handleAdminLogin() async {
    final email = _emailController.text.trim();
    final key = _keyController.text.trim();

    if (email.isEmpty || key.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter admin email and security clearance key.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final res = await ApiService.adminLogin(email, key);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message'] ?? 'Admin clearance verified.'),
          backgroundColor: AppTheme.emerald,
        ),
      );

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const AdminDashboardScreen()),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Admin Portal Clearance'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Security Shield Emblem
              Center(
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppTheme.bloodPrimary.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppTheme.bloodPrimary, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.bloodPrimary.withValues(alpha: 0.3),
                        blurRadius: 20,
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(Icons.shield, size: 44, color: AppTheme.bloodPrimary),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              const Text(
                'High-Security Access',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Restricted to verified medical supervisors and system administrators with authorized master keys.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: AppTheme.textMuted),
              ),

              const SizedBox(height: 28),

              // Clearance Notice Box
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.bloodPrimary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.bloodPrimary.withValues(alpha: 0.3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.lock, color: AppTheme.bloodLight, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Master Key: ADMIN@SECURE#2026',
                        style: TextStyle(
                          color: AppTheme.bloodLight,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Admin Email Field
              TextField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'Authorized Admin Email',
                  prefixIcon: Icon(Icons.email, color: AppTheme.textMuted),
                ),
                keyboardType: TextInputType.emailAddress,
              ),

              const SizedBox(height: 16),

              // Admin Security Key Field
              TextField(
                controller: _keyController,
                obscureText: _obscureKey,
                decoration: InputDecoration(
                  labelText: 'Special Clearance Key',
                  prefixIcon: const Icon(Icons.vpn_key, color: AppTheme.textMuted),
                  suffixIcon: IconButton(
                    icon: Icon(_obscureKey ? Icons.visibility : Icons.visibility_off, color: AppTheme.textMuted),
                    onPressed: () => setState(() => _obscureKey = !_obscureKey),
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // Autofill Button
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: _autofillCredentials,
                  icon: const Icon(Icons.auto_fix_high, size: 16, color: AppTheme.amber),
                  label: const Text('Autofill Clearance Key', style: TextStyle(color: AppTheme.amber)),
                ),
              ),

              const SizedBox(height: 24),

              // Login Button
              ElevatedButton(
                onPressed: _isLoading ? null : _handleAdminLogin,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.bloodPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('AUTHENTICATE & ENTER ADMIN CONSOLE', style: TextStyle(letterSpacing: 0.5)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
