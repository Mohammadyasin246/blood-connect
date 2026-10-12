import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'donor_dashboard_screen.dart';
import 'recipient_dashboard_screen.dart';
import 'login_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  String _selectedRole = 'donor';
  String _selectedBloodGroup = 'O+';
  String _selectedGender = 'male';

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _cityController = TextEditingController(text: 'Hyderabad');
  final _areaController = TextEditingController(text: 'Lingampally');
  final _dobController = TextEditingController(text: '1998-05-15');
  final _lastDonationController = TextEditingController(text: '2026-05-10');

  bool _isLoading = false;

  final List<String> _bloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _dobController.dispose();
    _lastDonationController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();
    final password = _passwordController.text.trim();

    if (name.isEmpty || email.isEmpty || phone.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all mandatory fields.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final payload = {
        'role': _selectedRole,
        'name': name,
        'email': email,
        'phone': phone,
        'password': password,
      };

      if (_selectedRole == 'donor') {
        payload['blood_group'] = _selectedBloodGroup;
        payload['gender'] = _selectedGender;
        payload['date_of_birth'] = _dobController.text.trim();
        payload['city'] = _cityController.text.trim();
        payload['area'] = _areaController.text.trim();
        payload['latitude'] = '17.4938';
        payload['longitude'] = '78.3188';
        payload['last_donation_date'] = _lastDonationController.text.trim();
      }

      final res = await ApiService.register(payload);
      final user = res['user'];

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Welcome to BloodConnect, ${user['name']}!'),
          backgroundColor: AppTheme.emerald,
        ),
      );

      if (_selectedRole == 'donor') {
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const DonorDashboardScreen()));
      } else {
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const RecipientDashboardScreen()));
      }
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
        title: const Text('Create Account'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Join BloodConnect',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Register as a life saver or connect to request blood.',
                style: TextStyle(fontSize: 14, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 20),

              // Role Selector (Screen C: Who are you?)
              const Text('Who are you?', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('🩸 Blood Donor')),
                      selected: _selectedRole == 'donor',
                      selectedColor: AppTheme.bloodPrimary,
                      onSelected: (val) => setState(() => _selectedRole = 'donor'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('🧑 Blood Recipient')),
                      selected: _selectedRole == 'recipient',
                      selectedColor: AppTheme.bloodPrimary,
                      onSelected: (val) => setState(() => _selectedRole = 'recipient'),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Basic Fields
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Full Name', prefixIcon: Icon(Icons.person, color: AppTheme.textMuted)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _phoneController,
                decoration: const InputDecoration(labelText: 'Mobile Number', prefixIcon: Icon(Icons.phone, color: AppTheme.textMuted)),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _emailController,
                decoration: const InputDecoration(labelText: 'Email Address', prefixIcon: Icon(Icons.email, color: AppTheme.textMuted)),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                decoration: const InputDecoration(labelText: 'Password', prefixIcon: Icon(Icons.lock, color: AppTheme.textMuted)),
                obscureText: true,
              ),

              // Extended Donor Fields (Section 5)
              if (_selectedRole == 'donor') ...[
                const SizedBox(height: 20),
                const Divider(color: Colors.white12),
                const Text('Donor Medical Profile', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.bloodLight)),
                const SizedBox(height: 12),

                // Blood Group and Gender Dropdowns
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _selectedBloodGroup,
                        decoration: const InputDecoration(labelText: 'Blood Group', prefixIcon: Icon(Icons.water_drop, color: AppTheme.bloodPrimary)),
                        items: _bloodGroups.map((bg) => DropdownMenuItem(value: bg, child: Text(bg, style: const TextStyle(fontWeight: FontWeight.bold)))).toList(),
                        onChanged: (val) => setState(() => _selectedBloodGroup = val!),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _selectedGender,
                        decoration: const InputDecoration(labelText: 'Gender', prefixIcon: Icon(Icons.person, color: AppTheme.textMuted)),
                        items: const [
                          DropdownMenuItem(value: 'male', child: Text('Male')),
                          DropdownMenuItem(value: 'female', child: Text('Female')),
                          DropdownMenuItem(value: 'other', child: Text('Other')),
                        ],
                        onChanged: (val) => setState(() => _selectedGender = val ?? 'male'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // City & Area
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _cityController,
                        decoration: const InputDecoration(labelText: 'City'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: _areaController,
                        decoration: const InputDecoration(labelText: 'Area / Locality'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Date of Birth & Last Donation Date
                TextField(
                  controller: _lastDonationController,
                  decoration: const InputDecoration(labelText: 'Last Donation Date (YYYY-MM-DD)', prefixIcon: Icon(Icons.calendar_month, color: AppTheme.textMuted)),
                ),
              ],

              const SizedBox(height: 28),

              ElevatedButton(
                onPressed: _isLoading ? null : _handleRegister,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('CREATE ACCOUNT &rarr;'),
              ),

              const SizedBox(height: 16),

              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Already have an account?', style: TextStyle(color: AppTheme.textMuted)),
                  TextButton(
                    onPressed: () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      );
                    },
                    child: const Text('Log In', style: TextStyle(color: AppTheme.bloodLight, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
