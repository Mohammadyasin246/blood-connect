import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'welcome_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _stats;
  List<dynamic> _users = [];
  List<dynamic> _bloodDist = [];

  @override
  void initState() {
    super.initState();
    _loadAdminData();
  }

  Future<void> _loadAdminData() async {
    setState(() => _isLoading = true);
    try {
      final statsRes = await ApiService.getAdminStats();
      final usersRes = await ApiService.getAdminUsers();

      setState(() {
        _stats = statsRes['stats'];
        _bloodDist = statsRes['blood_group_distribution'] ?? [];
        _users = usersRes;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load admin data: $e')),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleUser(int userId) async {
    try {
      final newStatus = await ApiService.toggleUserStatus(userId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(newStatus ? 'User account activated.' : 'User account disabled.'),
          backgroundColor: newStatus ? AppTheme.emerald : Colors.redAccent,
        ),
      );
      _loadAdminData();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final totalUsers = _stats?['total_users'] ?? 0;
    final totalDonors = _stats?['total_donors'] ?? 0;
    final activeReqs = _stats?['active_requests'] ?? 0;
    final completedReqs = _stats?['completed_requests'] ?? 0;

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shield, color: AppTheme.bloodPrimary, size: 20),
            SizedBox(width: 8),
            Text('Admin Console'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadAdminData,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ApiService.logout();
              if (!context.mounted) return;
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const WelcomeScreen()),
              );
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.bloodPrimary))
          : RefreshIndicator(
              onRefresh: _loadAdminData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Clearance Banner
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppTheme.bloodDark.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.bloodPrimary.withValues(alpha: 0.4)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.verified_user, color: AppTheme.bloodLight, size: 20),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Authorized Administrator: Dr. Arvind Verma (Master Clearance)',
                              style: TextStyle(color: AppTheme.bloodLight, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Metrics Grid (Section 15)
                    Row(
                      children: [
                        Expanded(
                          child: _buildMetricCard('Total Users', '$totalUsers', Icons.people, Colors.blue),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildMetricCard('Total Donors', '$totalDonors', Icons.water_drop, AppTheme.bloodPrimary),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _buildMetricCard('Active Requests', '$activeReqs', Icons.emergency, Colors.orange),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildMetricCard('Completed', '$completedReqs', Icons.check_circle, AppTheme.emerald),
                        ),
                      ],
                    ),

                    const SizedBox(height: 28),

                    // Blood Inventory Breakdown
                    const Text('BLOOD RESERVES SUMMARY', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 1.0)),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.bgCard,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white12),
                      ),
                      child: Wrap(
                        spacing: 12,
                        runSpacing: 10,
                        children: _bloodDist.map((item) {
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.04),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: Colors.white12),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  item['blood_group'] ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.bloodLight),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  '${item['count']} donors',
                                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),

                    const SizedBox(height: 28),

                    // User Management Directory (Section 15)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'USER MANAGEMENT DIRECTORY',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 1.0),
                        ),
                        Text(
                          '${_users.length} accounts',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _users.length,
                      itemBuilder: (context, index) {
                        final u = _users[index];
                        final isActive = u['is_active'] == 1 || u['is_active'] == true;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppTheme.bgCard,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: Colors.white12),
                          ),
                          child: Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: AppTheme.bloodPrimary.withValues(alpha: 0.2),
                                child: Text(
                                  (u['name'] ?? 'U').toString().substring(0, 1).toUpperCase(),
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      u['name'] ?? 'User',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${u['email']} • ${u['role']}',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                    ),
                                  ],
                                ),
                              ),
                              TextButton(
                                onPressed: () => _toggleUser(u['user_id']),
                                style: TextButton.styleFrom(
                                  backgroundColor: isActive ? AppTheme.emerald.withValues(alpha: 0.15) : Colors.red.withValues(alpha: 0.15),
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                ),
                                child: Text(
                                  isActive ? 'Active' : 'Disabled',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: isActive ? AppTheme.emerald : Colors.redAccent,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMetricCard(String title, String val, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
              Icon(icon, color: color, size: 18),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            val,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
