import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class CreateRequestScreen extends StatefulWidget {
  final bool isEmergency;
  const CreateRequestScreen({super.key, this.isEmergency = false});

  @override
  State<CreateRequestScreen> createState() => _CreateRequestScreenState();
}

class _CreateRequestScreenState extends State<CreateRequestScreen> {
  final _patientNameController = TextEditingController();
  final _hospitalController = TextEditingController(text: 'Citizens Specialty Hospital, Lingampally');
  final _cityController = TextEditingController(text: 'Hyderabad');
  final _areaController = TextEditingController(text: 'Lingampally');
  final _unitsController = TextEditingController(text: '1');
  final _dateController = TextEditingController(text: '2026-10-08');
  final _notesController = TextEditingController();

  String _selectedBloodGroup = 'O+';
  String _selectedUrgency = 'emergency';
  bool _isLoading = false;

  final List<String> _bloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  @override
  void initState() {
    super.initState();
    _selectedUrgency = widget.isEmergency ? 'emergency' : 'normal';
  }

  @override
  void dispose() {
    _patientNameController.dispose();
    _hospitalController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _unitsController.dispose();
    _dateController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submitRequest() async {
    final patientName = _patientNameController.text.trim();
    final hospital = _hospitalController.text.trim();

    if (patientName.isEmpty || hospital.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter patient name and hospital.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final payload = {
        'patient_name': patientName,
        'blood_group': _selectedBloodGroup,
        'units_required': int.tryParse(_unitsController.text.trim()) ?? 1,
        'hospital': hospital,
        'city': _cityController.text.trim(),
        'area': _areaController.text.trim(),
        'latitude': '17.4950',
        'longitude': '78.3175',
        'required_date': _dateController.text.trim(),
        'urgency': _selectedUrgency,
        'additional_notes': _notesController.text.trim(),
      };

      final res = await ApiService.createBloodRequest(payload);
      final count = res['matched_donors_count'] ?? 0;

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Request broadcasted! Notified $count compatible donors nearby.'),
          backgroundColor: AppTheme.emerald,
          duration: const Duration(seconds: 4),
        ),
      );

      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: ${e.toString().replaceAll('Exception: ', '')}')),
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
        title: Text(widget.isEmergency ? '🚨 Emergency Blood Request' : 'Request Blood'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: widget.isEmergency ? Colors.red.withValues(alpha: 0.15) : AppTheme.bloodPrimary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: widget.isEmergency ? Colors.redAccent : AppTheme.bloodPrimary),
                ),
                child: Row(
                  children: [
                    Text(widget.isEmergency ? '🚨' : '🩸', style: const TextStyle(fontSize: 28)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        widget.isEmergency
                            ? 'Immediate emergency broadcast to nearest donors within kilometers.'
                            : 'Broadcast request to compatible verified volunteer donors.',
                        style: const TextStyle(fontSize: 13, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Patient Name
              TextField(
                controller: _patientNameController,
                decoration: const InputDecoration(
                  labelText: 'Patient Full Name',
                  prefixIcon: Icon(Icons.person, color: AppTheme.textMuted),
                ),
              ),

              const SizedBox(height: 16),

              // Blood Group & Units Required
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: DropdownButtonFormField<String>(
                      initialValue: _selectedBloodGroup,
                      decoration: const InputDecoration(
                        labelText: 'Blood Group',
                        prefixIcon: Icon(Icons.water_drop, color: AppTheme.bloodPrimary),
                      ),
                      items: _bloodGroups.map((bg) => DropdownMenuItem(value: bg, child: Text(bg, style: const TextStyle(fontWeight: FontWeight.bold)))).toList(),
                      onChanged: (val) => setState(() => _selectedBloodGroup = val!),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 1,
                    child: TextField(
                      controller: _unitsController,
                      decoration: const InputDecoration(labelText: 'Units'),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Hospital Name
              TextField(
                controller: _hospitalController,
                decoration: const InputDecoration(
                  labelText: 'Hospital Name',
                  prefixIcon: Icon(Icons.local_hospital, color: AppTheme.textMuted),
                ),
              ),

              const SizedBox(height: 16),

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
                      decoration: const InputDecoration(labelText: 'Area / Location'),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Required Date
              TextField(
                controller: _dateController,
                decoration: const InputDecoration(
                  labelText: 'Required Date (YYYY-MM-DD)',
                  prefixIcon: Icon(Icons.calendar_today, color: AppTheme.textMuted),
                ),
              ),

              const SizedBox(height: 20),

              // Urgency Selector (Section 8)
              const Text('Urgency Level', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('Normal')),
                      selected: _selectedUrgency == 'normal',
                      onSelected: (val) => setState(() => _selectedUrgency = 'normal'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('⚠️ Urgent')),
                      selected: _selectedUrgency == 'urgent',
                      selectedColor: Colors.amber.withValues(alpha: 0.3),
                      onSelected: (val) => setState(() => _selectedUrgency = 'urgent'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('🚨 Emergency')),
                      selected: _selectedUrgency == 'emergency',
                      selectedColor: Colors.redAccent.withValues(alpha: 0.4),
                      onSelected: (val) => setState(() => _selectedUrgency = 'emergency'),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Additional Notes
              TextField(
                controller: _notesController,
                decoration: const InputDecoration(
                  labelText: 'Additional Notes / ICU Bed',
                  hintText: 'e.g. ICU cardiac replacement surgery',
                ),
                maxLines: 2,
              ),

              const SizedBox(height: 28),

              ElevatedButton(
                onPressed: _isLoading ? null : _submitRequest,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _selectedUrgency == 'emergency' ? const Color(0xFFDC2626) : AppTheme.bloodPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('CREATE & BROADCAST REQUEST 🚨', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
