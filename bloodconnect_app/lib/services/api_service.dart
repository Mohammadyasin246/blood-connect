import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Use localhost for Web/Desktop/iOS and 10.0.2.2 for Android emulator
  static String baseUrl = kIsWeb
      ? 'http://localhost:5000/api'
      : (defaultTargetPlatform == TargetPlatform.android
          ? 'http://10.0.2.2:5000/api'
          : 'http://localhost:5000/api');

  static String? _token;
  static Map<String, dynamic>? currentUser;

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
    final userStr = prefs.getString('user_data');
    if (userStr != null) {
      try {
        currentUser = jsonDecode(userStr);
      } catch (_) {}
    }
  }

  static bool get isAuthenticated => _token != null;

  static Map<String, String> _headers() {
    return {
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };
  }

  // Regular Login
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      _token = data['token'];
      currentUser = data['user'];
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', _token!);
      await prefs.setString('user_data', jsonEncode(currentUser));
      return data;
    } else {
      throw Exception(data['message'] ?? 'Login failed');
    }
  }

  // High-Security Admin Login with Special Credentials
  static Future<Map<String, dynamic>> adminLogin(String email, String adminKey) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/admin-login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'adminKey': adminKey}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      _token = data['token'];
      currentUser = data['user'];
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', _token!);
      await prefs.setString('user_data', jsonEncode(currentUser));
      return data;
    } else {
      throw Exception(data['message'] ?? 'Admin authorization failed');
    }
  }

  // Register
  static Future<Map<String, dynamic>> register(Map<String, dynamic> payload) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 201 && data['success'] == true) {
      _token = data['token'];
      currentUser = data['user'];
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', _token!);
      await prefs.setString('user_data', jsonEncode(currentUser));
      return data;
    } else {
      throw Exception(data['message'] ?? 'Registration failed');
    }
  }

  // Logout
  static Future<void> logout() async {
    _token = null;
    currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_data');
  }

  // Donor Dashboard Stats
  static Future<Map<String, dynamic>> getDonorDashboardStats() async {
    final response = await http.get(
      Uri.parse('$baseUrl/donors/dashboard-stats'),
      headers: _headers(),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data;
    }
    throw Exception(data['message'] ?? 'Failed to load donor dashboard');
  }

  // Toggle Donor Availability
  static Future<bool> toggleAvailability(bool available) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/donors/availability'),
      headers: _headers(),
      body: jsonEncode({'availability': available}),
    );

    final data = jsonDecode(response.body);
    return data['availability'] == true;
  }

  // Search Donors with Haversine Proximity
  static Future<List<dynamic>> searchDonors({
    String bloodGroup = 'ALL',
    double radius = 15.0,
    bool availableOnly = true,
    double lat = 17.4938,
    double lon = 78.3188,
  }) async {
    final uri = Uri.parse('$baseUrl/donors/search').replace(queryParameters: {
      'blood_group': bloodGroup,
      'radius': radius.toString(),
      'available_only': availableOnly ? 'true' : 'false',
      'latitude': lat.toString(),
      'longitude': lon.toString(),
    });

    final response = await http.get(uri, headers: _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return data['donors'] ?? [];
    }
    return [];
  }

  // Create Blood Request
  static Future<Map<String, dynamic>> createBloodRequest(Map<String, dynamic> payload) async {
    final response = await http.post(
      Uri.parse('$baseUrl/requests'),
      headers: _headers(),
      body: jsonEncode(payload),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 201 && data['success'] == true) {
      return data;
    }
    throw Exception(data['message'] ?? 'Failed to create blood request');
  }

  // Get All Requests
  static Future<List<dynamic>> getAllRequests({bool myRequests = false}) async {
    final uri = Uri.parse('$baseUrl/requests').replace(queryParameters: {
      if (myRequests) 'my_requests': 'true',
    });

    final response = await http.get(uri, headers: _headers());
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return data['requests'] ?? [];
    }
    return [];
  }

  // Accept Request
  static Future<Map<String, dynamic>> acceptRequest(int requestId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/requests/$requestId/accept'),
      headers: _headers(),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return data;
    }
    throw Exception(data['message'] ?? 'Failed to accept request');
  }

  // Decline Request
  static Future<void> declineRequest(int requestId) async {
    await http.post(
      Uri.parse('$baseUrl/requests/$requestId/decline'),
      headers: _headers(),
    );
  }

  // Complete Request
  static Future<Map<String, dynamic>> completeRequest(int requestId, int units) async {
    final response = await http.post(
      Uri.parse('$baseUrl/requests/$requestId/complete'),
      headers: _headers(),
      body: jsonEncode({'units': units, 'notes': 'Life-saving donation completed'}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return data;
    }
    throw Exception(data['message'] ?? 'Failed to complete donation');
  }

  // Donation History
  static Future<List<dynamic>> getDonations() async {
    final response = await http.get(
      Uri.parse('$baseUrl/donations'),
      headers: _headers(),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return data['donations'] ?? [];
    }
    return [];
  }

  // Admin Telemetry Stats
  static Future<Map<String, dynamic>> getAdminStats() async {
    final response = await http.get(
      Uri.parse('$baseUrl/admin/stats'),
      headers: _headers(),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return data;
    }
    throw Exception(data['message'] ?? 'Failed to load admin stats');
  }

  // Admin Users List
  static Future<List<dynamic>> getAdminUsers() async {
    final response = await http.get(
      Uri.parse('$baseUrl/admin/users'),
      headers: _headers(),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return data['users'] ?? [];
    }
    return [];
  }

  // Admin Toggle User Status
  static Future<bool> toggleUserStatus(int userId) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/admin/users/$userId/status'),
      headers: _headers(),
    );

    final data = jsonDecode(response.body);
    return data['is_active'] == true;
  }
}
