import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'create_request_screen.dart';
import 'donor_search_screen.dart';
import 'welcome_screen.dart';

class RecipientDashboardScreen extends StatefulWidget {
  const RecipientDashboardScreen({super.key});

  @override
  State<RecipientDashboardScreen> createState() => _RecipientDashboardScreenState();
}

class _RecipientDashboardScreenState extends State<RecipientDashboardScreen> {
  bool _isLoading = true;
  List<dynamic> _myRequests = [];

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    setState(() => _isLoading = true);
    try {
      final reqs = await ApiService.getAllRequests(myRequests: true);
      setState(() => _myRequests = reqs);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load requests: $e')),
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
        title: const Text('My Blood Requests'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadRequests,
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final res = await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const CreateRequestScreen()),
          );
          if (res == true) _loadRequests();
        },
        backgroundColor: AppTheme.bloodPrimary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Request', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.bloodPrimary))
          : RefreshIndicator(
              onRefresh: _loadRequests,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Top Card
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: AppTheme.bgCard,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white12),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppTheme.bloodPrimary.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.medical_services, color: AppTheme.bloodPrimary, size: 28),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Active Requests: ${_myRequests.length}',
                                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  'Broadcasted to nearby verified donors',
                                  style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                ),
                              ],
                            ),
                          ),
                          OutlinedButton(
                            onPressed: () {
                              Navigator.push(context, MaterialPageRoute(builder: (_) => const DonorSearchScreen()));
                            },
                            child: const Text('Find Donors', style: TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    if (_myRequests.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(36),
                        decoration: BoxDecoration(
                          color: AppTheme.bgCard,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Column(
                          children: [
                            const Text('📋', style: TextStyle(fontSize: 36)),
                            const SizedBox(height: 12),
                            const Text(
                              'No Active Blood Requests',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Create a request to broadcast to matching volunteer donors within kilometers.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                            ),
                            const SizedBox(height: 20),
                            ElevatedButton(
                              onPressed: () async {
                                final res = await Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const CreateRequestScreen()),
                                );
                                if (res == true) _loadRequests();
                              },
                              child: const Text('Create Blood Request'),
                            ),
                          ],
                        ),
                      )
                    else
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _myRequests.length,
                        itemBuilder: (context, index) {
                          final req = _myRequests[index];
                          final isEmergency = req['urgency'] == 'emergency';
                          final status = req['status'] ?? 'open';
                          final matchedDonor = req['accepted_donor_name'];

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
                                        color: status == 'completed'
                                            ? AppTheme.emerald.withValues(alpha: 0.2)
                                            : status == 'matched'
                                                ? Colors.blue.withValues(alpha: 0.2)
                                                : Colors.amber.withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        status.toString().toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: status == 'completed'
                                              ? AppTheme.emerald
                                              : status == 'matched'
                                                  ? Colors.lightBlueAccent
                                                  : Colors.amber,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  '🏥 ${req['hospital'] ?? ''}',
                                  style: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '💉 ${req['units_required'] ?? 1} Unit(s) • Required: ${req['required_date'] ?? ''}',
                                  style: const TextStyle(fontSize: 13, color: Colors.white70),
                                ),
                                if (matchedDonor != null) ...[
                                  const SizedBox(height: 8),
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: AppTheme.emerald.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: AppTheme.emerald.withValues(alpha: 0.3)),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.check_circle, size: 16, color: AppTheme.emerald),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(
                                            'Matched Donor: $matchedDonor (${req['accepted_donor_phone'] ?? ''})',
                                            style: const TextStyle(fontSize: 12, color: AppTheme.emerald, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
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
