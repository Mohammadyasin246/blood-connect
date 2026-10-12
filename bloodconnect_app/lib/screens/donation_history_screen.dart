import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class DonationHistoryScreen extends StatefulWidget {
  const DonationHistoryScreen({super.key});

  @override
  State<DonationHistoryScreen> createState() => _DonationHistoryScreenState();
}

class _DonationHistoryScreenState extends State<DonationHistoryScreen> {
  bool _isLoading = true;
  List<dynamic> _donations = [];

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getDonations();
      setState(() => _donations = res);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load history: $e')),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showCertificateDialog(Map<String, dynamic> donation) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppTheme.bloodDark, width: 4),
        ),
        title: const Center(
          child: Column(
            children: [
              Text('🎖️', style: TextStyle(fontSize: 36)),
              SizedBox(height: 4),
              Text(
                'OFFICIAL CERTIFICATE',
                style: TextStyle(
                  color: AppTheme.bloodDark,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                  letterSpacing: 1.5,
                ),
              ),
              Text(
                'National Blood Transfusion Initiative',
                style: TextStyle(color: Colors.grey, fontSize: 11),
              ),
            ],
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Divider(color: Colors.black12),
            const SizedBox(height: 8),
            const Text('Awarded for life-saving voluntary donation at', style: TextStyle(color: Colors.black87, fontSize: 13)),
            const SizedBox(height: 4),
            Text(
              donation['hospital_name'] ?? 'Verified Hospital',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.black),
            ),
            const SizedBox(height: 8),
            Text(
              'Date: ${donation['donation_date']} • Units: ${donation['units']} (${donation['blood_group']})',
              style: const TextStyle(color: Colors.black54, fontSize: 12),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                'Certificate ID: ${donation['certificate_id'] ?? 'BC-CERT-2026'}',
                style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Colors.black87, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 12),
            const Text('Verified Authentic Record ✅', style: TextStyle(color: AppTheme.emerald, fontSize: 12, fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close', style: TextStyle(color: AppTheme.bloodPrimary)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgDark,
      appBar: AppBar(
        title: const Text('Donation History'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.bloodPrimary))
          : _donations.isEmpty
              ? const Center(
                  child: Text(
                    'No donations recorded yet.',
                    style: TextStyle(color: AppTheme.textMuted),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _donations.length,
                  itemBuilder: (context, index) {
                    final item = _donations[index];

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
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
                              color: AppTheme.emerald.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.verified, color: AppTheme.emerald, size: 28),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item['hospital_name'] ?? 'Hospital',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Date: ${item['donation_date']} • ${item['blood_group']}',
                                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Units: ${item['units']} • Completed',
                                  style: const TextStyle(color: AppTheme.emerald, fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.card_membership, color: AppTheme.bloodLight),
                            tooltip: 'View Certificate',
                            onPressed: () => _showCertificateDialog(item),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
