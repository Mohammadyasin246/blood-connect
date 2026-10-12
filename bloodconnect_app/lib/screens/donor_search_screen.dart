import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'create_request_screen.dart';

class DonorSearchScreen extends StatefulWidget {
  const DonorSearchScreen({super.key});

  @override
  State<DonorSearchScreen> createState() => _DonorSearchScreenState();
}

class _DonorSearchScreenState extends State<DonorSearchScreen> {
  String _selectedBloodGroup = 'ALL';
  double _radius = 15.0;
  bool _availableOnly = true;
  bool _isLoading = false;
  List<dynamic> _donors = [];

  final List<String> _bloodGroups = ['ALL', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  @override
  void initState() {
    super.initState();
    _performSearch();
  }

  Future<void> _performSearch() async {
    setState(() => _isLoading = true);
    try {
      final results = await ApiService.searchDonors(
        bloodGroup: _selectedBloodGroup,
        radius: _radius,
        availableOnly: _availableOnly,
      );
      setState(() => _donors = results);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Search error: $e')),
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
        title: const Text('Find a Donor'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Filter Controls (Section 9)
            Container(
              padding: const EdgeInsets.all(18),
              color: AppTheme.bgCard,
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _selectedBloodGroup,
                          decoration: const InputDecoration(labelText: 'Blood Group'),
                          items: _bloodGroups.map((bg) => DropdownMenuItem(value: bg, child: Text(bg, style: const TextStyle(fontWeight: FontWeight.bold)))).toList(),
                          onChanged: (val) {
                            setState(() => _selectedBloodGroup = val!);
                            _performSearch();
                          },
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Radius: ${_radius.toInt()} km', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.bloodLight)),
                            Slider(
                              value: _radius,
                              min: 1.0,
                              max: 50.0,
                              activeColor: AppTheme.bloodPrimary,
                              onChanged: (val) => setState(() => _radius = val),
                              onChangeEnd: (_) => _performSearch(),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Checkbox(
                            value: _availableOnly,
                            activeColor: AppTheme.bloodPrimary,
                            onChanged: (val) {
                              setState(() => _availableOnly = val ?? true);
                              _performSearch();
                            },
                          ),
                          const Text('Available Donors Only', style: TextStyle(fontSize: 13)),
                        ],
                      ),
                      ElevatedButton(
                        onPressed: _isLoading ? null : _performSearch,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        ),
                        child: const Text('SEARCH 🔍', style: TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Results List
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.bloodPrimary))
                  : _donors.isEmpty
                      ? const Center(
                          child: Text(
                            'No matching donors found in this radius.\nTry expanding search radius.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AppTheme.textMuted),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _donors.length,
                          itemBuilder: (context, index) {
                            final donor = _donors[index];
                            final isAvail = donor['availability'] == true;
                            final dist = donor['distance_km'] ?? '0.0';

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
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      color: isAvail ? AppTheme.bloodPrimary : Colors.grey.shade800,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Center(
                                      child: Text(
                                        donor['blood_group'] ?? '',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          donor['name'] ?? 'Donor',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                        ),
                                        const SizedBox(height: 2),
                                        Row(
                                          children: [
                                            Text(
                                              '$dist km away',
                                              style: const TextStyle(color: AppTheme.emerald, fontWeight: FontWeight.bold, fontSize: 13),
                                            ),
                                            const SizedBox(width: 8),
                                            Text(
                                              '• ${donor['area'] ?? donor['city']}',
                                              style: const TextStyle(color: AppTheme.textMuted, fontSize: 13),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          isAvail ? '🟢 Available' : '🔴 Busy',
                                          style: TextStyle(
                                            color: isAvail ? AppTheme.emerald : Colors.redAccent,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  ElevatedButton(
                                    onPressed: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => const CreateRequestScreen(),
                                        ),
                                      );
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.bloodPrimary,
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    ),
                                    child: const Text('REQUEST', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
