import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'donor_search_screen.dart';
import 'donation_history_screen.dart';
import 'welcome_screen.dart';

class DonorDashboardScreen extends StatefulWidget {
  const DonorDashboardScreen({super.key});

  @override
  State<DonorDashboardScreen> createState() => _DonorDashboardScreenState();
}

class _DonorDashboardScreenState extends State<DonorDashboardScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _donorData;
  Map<String, dynamic>? _stats;
  List<dynamic> _nearbyRequests = [];
  bool _isAvailable = true;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getDonorDashboardStats();
      setState(() {
        _donorData = res['donor'];
        _stats = res['stats'];
        _nearbyRequests = res['nearby_requests'] ?? [];
        _isAvailable = _stats?['is_available'] ?? true;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load dashboard: $e')),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleAvailability(bool val) async {
    try {
      final newStatus = await ApiService.toggleAvailability(val);
      setState(() => _isAvailable = newStatus);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isAvailable ? '🟢 Available to Donate' : '🔴 Marked Unavailable'),
          backgroundColor: _isAvailable ? AppTheme.emerald : Colors.redAccent,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update availability: $e')),
      );
    }
  }

  Future<void> _acceptRequest(int requestId) async {
    try {
      final res = await ApiService.acceptRequest(requestId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message'] ?? 'Request accepted! Thank you for saving a life.'),
          backgroundColor: AppTheme.emerald,
        ),
      );
      _loadDashboard();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  Future<void> _declineRequest(int requestId) async {
    await ApiService.declineRequest(requestId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Request dismissed.')),
    );
    _loadDashboard();
  }

  @override
  Widget build(BuildContext context) {
    final userName = ApiService.currentUser?['name']?.split(' ')?.first ?? 'Rahul';
    final bloodGroup = _donorData?['blood_group'] ?? 'O+';
    final totalDonations = _stats?['total_donations'] ?? 0;

    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: Text('Welcome, $userName 👋'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDashboard,
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
              onRefresh: _loadDashboard,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Blood Group & Availability Card (Section 7)
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppTheme.bloodPrimary.withValues(alpha: 0.2),
                            AppTheme.bgCard,
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.bloodPrimary.withValues(alpha: 0.3)),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 56,
                                    height: 56,
                                    decoration: BoxDecoration(
                                      color: AppTheme.bloodPrimary,
                                      borderRadius: BorderRadius.circular(16),
                                      boxShadow: [
                                        BoxShadow(
                                          color: AppTheme.bloodPrimary.withValues(alpha: 0.5),
                                          blurRadius: 15,
                                        ),
                                      ],
                                    ),
                                    child: Center(
                                      child: Text(
                                        bloodGroup,
                                        style: const TextStyle(
                                          fontSize: 22,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Blood Group: $bloodGroup',
                                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        _isAvailable ? '🟢 Available to Donate' : '🔴 Currently Busy',
                                        style: TextStyle(
                                          fontSize: 13,
                                          color: _isAvailable ? AppTheme.emerald : Colors.redAccent,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              Switch(
                                value: _isAvailable,
                                activeThumbColor: AppTheme.emerald,
                                onChanged: _toggleAvailability,
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          const Divider(color: Colors.white12),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              Column(
                                children: [
                                  Text(
                                    '$totalDonations',
                                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text('My Donations', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                ],
                              ),
                              Column(
                                children: [
                                  Text(
                                    '${_nearbyRequests.length}',
                                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.bloodLight),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text('Nearby Requests', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                ],
                              ),
                              const Column(
                                children: [
                                  Text(
                                    'Safe',
                                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.emerald),
                                  ),
                                  SizedBox(height: 2),
                                  Text('Eligibility', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Quick Actions Section (Section 7)
                    const Text('QUICK ACTIONS', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 1.0)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () {
                              Navigator.push(context, MaterialPageRoute(builder: (_) => const DonorSearchScreen()));
                            },
                            icon: const Icon(Icons.search, size: 18),
                            label: const Text('Find Donors', style: TextStyle(fontSize: 13)),
                            style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () {
                              Navigator.push(context, MaterialPageRoute(builder: (_) => const DonationHistoryScreen()));
                            },
                            icon: const Icon(Icons.history, size: 18),
                            label: const Text('My History', style: TextStyle(fontSize: 13)),
                            style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 28),

                    // Nearby Requests Feed (Sections 7 & 10)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Nearby Requests: ${_nearbyRequests.length}',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        TextButton(
                          onPressed: _loadDashboard,
                          child: const Text('Refresh', style: TextStyle(color: AppTheme.bloodLight)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    if (_nearbyRequests.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(32),
                        decoration: BoxDecoration(
                          color: AppTheme.bgCard,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: const Column(
                          children: [
                            Text('🎉', style: TextStyle(fontSize: 32)),
                            SizedBox(height: 8),
                            Text('No Active Requests Right Now', style: TextStyle(fontWeight: FontWeight.bold)),
                            SizedBox(height: 4),
                            Text('You will receive alerts when someone near you needs blood.', textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
                          ],
                        ),
                      )
                    else
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _nearbyRequests.length,
                        itemBuilder: (context, index) {
                          final req = _nearbyRequests[index];
                          final isEmergency = req['urgency'] == 'emergency';
                          final dist = req['distance_km'] ?? '0.0';

                          return Container(
                            margin: const EdgeInsets.only(bottom: 14),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppTheme.bgCard,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isEmergency ? AppTheme.bloodPrimary : Colors.white12,
                                width: isEmergency ? 1.5 : 1.0,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: AppTheme.bloodPrimary.withValues(alpha: 0.2),
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: AppTheme.bloodPrimary),
                                          ),
                                          child: Text(
                                            req['blood_group'] ?? '',
                                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          req['patient_name'] ?? 'Patient',
                                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                        ),
                                      ],
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: isEmergency ? Colors.red.withValues(alpha: 0.2) : Colors.amber.withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        (req['urgency'] ?? 'Normal').toString().toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: isEmergency ? Colors.redAccent : Colors.amber,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    const Icon(Icons.local_hospital, size: 14, color: AppTheme.textMuted),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        req['hospital'] ?? 'Hospital',
                                        style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(Icons.location_on, size: 14, color: AppTheme.emerald),
                                    const SizedBox(width: 4),
                                    Text(
                                      '$dist km away',
                                      style: const TextStyle(fontSize: 13, color: AppTheme.emerald, fontWeight: FontWeight.bold),
                                    ),
                                    const SizedBox(width: 14),
                                    const Icon(Icons.water_drop, size: 14, color: AppTheme.bloodLight),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${req['units_required'] ?? 1} Unit(s)',
                                      style: const TextStyle(fontSize: 13, color: AppTheme.bloodLight),
                                    ),
                                  ],
                                ),
                                if (req['additional_notes'] != null && req['additional_notes'].toString().isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    '“${req['additional_notes']}”',
                                    style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.white70),
                                  ),
                                ],
                                const SizedBox(height: 14),
                                Row(
                                  children: [
                                    Expanded(
                                      child: ElevatedButton(
                                        onPressed: () => _acceptRequest(req['request_id']),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppTheme.bloodPrimary,
                                          padding: const EdgeInsets.symmetric(vertical: 10),
                                        ),
                                        child: const Text('ACCEPT 🩸', style: TextStyle(fontWeight: FontWeight.bold)),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    OutlinedButton(
                                      onPressed: () => _declineRequest(req['request_id']),
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                                      ),
                                      child: const Text('Decline'),
                                    ),
                                  ],
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
}
