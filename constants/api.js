// 📡 api.js — Handles all API calls between Expo app and Flask backend

import Constants from "expo-constants";

const BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  Constants.manifest?.extra?.apiUrl;


/* -------------------- Helper: Parse response safely -------------------- */
async function handleResponse(res) {
  try {
    const text = await res.text();
    console.log("📩 Raw response:", text);

    let data;
    try {
      data = JSON.parse(text || "{}");
    } catch (err) {
      console.error("⚠️ JSON parse failed:", err);
      return { success: false, msg: "Invalid JSON from server" };
    }

    if (!res.ok) {
      return {
        success: false,
        msg: data.msg || `Server error (${res.status})`,
      };
    }

    // Ensure we always return a consistent object
    if (typeof data !== "object" || data === null) {
      return { success: false, msg: "Unexpected response structure" };
    }

    return data;
  } catch (err) {
    console.error("❌ Response handler crashed:", err);
    return { success: false, msg: "Network or parsing error" };
  }
}

/* -------------------- 🔐 Login via 4-digit PIN -------------------- */
export async function loginByPin(pin) {
  try {
    if (!pin || pin.length < 4)
      return { success: false, msg: "PIN must be 4 digits" };

    console.log("🔑 Sending PIN login request:", pin);

    const res = await fetch(`${BASE_URL}/login_pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    const data = await handleResponse(res);
    console.log("✅ Parsed login response:", data);

    // Normalize structure
    if (!data.success) return data;
    if (!data.user || !data.role)
      return { success: false, msg: "Invalid user data" };

    return data;
  } catch (err) {
    console.error("⚠️ Login network error:", err);
    return { success: false, msg: "Network connection failed" };
  }
}

/* -------------------- 🕒 Punch In / Punch Out (with GPS location) -------------------- */
export async function punchActionMobile(pin, type, locationData = null) {
  try {
    if (!pin) return { success: false, msg: "PIN missing" };
    if (!["in", "out"].includes(type))
      return { success: false, msg: "Invalid punch type" };

    console.log("🕒 Punch action request:", { pin, type, location: locationData });

    // Prepare request body
    const requestBody = {
      pin,
      type,
    };

    // Add location data if available
    if (locationData) {
      requestBody.location = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        city: locationData.address?.split(',')[0] || 'Unknown',
        timestamp: locationData.timestamp || new Date().toISOString(),
      };
    }

    const res = await fetch(`${BASE_URL}/mobile/punch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await handleResponse(res);
    console.log("✅ Punch result:", data);

    return data;
  } catch (err) {
    console.error("⚠️ Punch network error:", err);
    return { success: false, msg: "Network connection failed" };
  }
}

/* -------------------- 📅 Fetch Employee History -------------------- */
export async function getHistory(empId) {
  try {
    if (!empId) return { attendance: [], leave: [] };

    console.log("📜 Fetching history for employee:", empId);

    const res = await fetch(`${BASE_URL}/mobile/history/${empId}`, {
      headers: { "Content-Type": "application/json" },
    });

    const data = await handleResponse(res);
    console.log("✅ History data received:", data);

    // Flask returns { attendance: [...], leave: [...] }
    if (data.attendance && Array.isArray(data.attendance)) {
      return data; // Return the full object with both arrays
    }

    // Fallback for old format
    if (Array.isArray(data)) return { attendance: data, leave: [] };
    if (data.success && Array.isArray(data.history)) 
      return { attendance: data.history, leave: [] };

    return { attendance: [], leave: [] };
  } catch (err) {
    console.error("⚠️ History fetch error:", err);
    return { attendance: [], leave: [] };
  }
}

/* -------------------- 👤 Get Employee Profile -------------------- */
export async function getEmployeeProfile(empCode) {
  try {
    if (!empCode) return { success: false, msg: "Employee code required" };

    console.log("👤 Fetching profile for employee:", empCode);

    const res = await fetch(`${BASE_URL}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emp_code: empCode }),
    });

    const data = await handleResponse(res);
    console.log("✅ Profile data received:", data);

    return data;
  } catch (err) {
    console.error("⚠️ Profile fetch error:", err);
    return { success: false, msg: "Network connection failed" };
  }
}

/* -------------------- 📝 Apply Leave -------------------- */
export async function applyLeave(empId, leaveType, reason, fromDate = null, toDate = null) {
  try {
    if (!empId) return { success: false, msg: "Employee ID required" };
    if (!leaveType || !["quick", "custom"].includes(leaveType)) {
      return { success: false, msg: "Invalid leave type" };
    }

    console.log("📝 Applying leave:", { empId, leaveType, reason, fromDate, toDate });

    const requestBody = {
      emp_id: empId,
      type: leaveType,
      reason: reason || "No reason provided",
    };

    // Add dates for custom leave
    if (leaveType === "custom") {
      if (!fromDate || !toDate) {
        return { success: false, msg: "From date and to date required for custom leave" };
      }
      requestBody.from_date = fromDate;
      requestBody.to_date = toDate;
    }

    const res = await fetch(`${BASE_URL}/api/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await handleResponse(res);
    console.log("✅ Leave application result:", data);

    return data;
  } catch (err) {
    console.error("⚠️ Leave application error:", err);
    return { success: false, msg: "Network connection failed" };
  }
}

/* -------------------- 🔍 Get Employee by PIN (Who Am I) -------------------- */
export async function getEmployeeByPin(pin) {
  try {
    if (!pin) return { success: false, msg: "PIN required" };

    console.log("🔍 Fetching employee by PIN:", pin);

    const res = await fetch(`${BASE_URL}/mobile/whoami/${pin}`, {
      headers: { "Content-Type": "application/json" },
    });

    const data = await handleResponse(res);
    console.log("✅ Employee data received:", data);

    return data;
  } catch (err) {
    console.error("⚠️ Get employee error:", err);
    return { success: false, msg: "Network connection failed" };
  }
}

/* -------------------- 🏥 Health Check (Ping) -------------------- */
export async function pingServer() {
  try {
    const res = await fetch(`${BASE_URL}/ping_json`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await handleResponse(res);
    return data;
  } catch (err) {
    console.error("⚠️ Ping error:", err);
    return { pong: false, msg: "Server unreachable" };
  }
}

/* -------------------- 🗺️ Helper: Format Location for Display -------------------- */
export function formatLocation(locationString) {
  if (!locationString || locationString === "—") return null;

  const parts = locationString.split('|');
  if (parts.length === 3) {
    return {
      address: parts[0],
      latitude: parseFloat(parts[1]),
      longitude: parseFloat(parts[2]),
      mapsUrl: `https://www.google.com/maps?q=${parts[1]},${parts[2]}`,
    };
  }

  return {
    address: locationString,
    latitude: null,
    longitude: null,
    mapsUrl: null,
  };
}
// Add this function to your api.js file
export const updateProfilePicture = async (emp_code, imageUri) => {
  try {
    // Create form data
    const formData = new FormData();
    
    // Extract file name and type from URI
    const filename = imageUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    formData.append('profile_picture', {
      uri: imageUri,
      name: filename,
      type: type,
    });
    formData.append('emp_code', emp_code);
    formData.append('type', 'profile_picture');
    
    const response = await fetch(`${API_URL}/upload-profile-picture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json',
      },
      body: formData,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

// Alternative: If you want to upload as base64 (simpler)
export const updateProfilePictureBase64 = async (emp_code, base64Image) => {
  try {
    const response = await fetch(`${API_URL}/upload-profile-picture-base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        emp_code: emp_code,
        image: base64Image,
        type: 'profile_picture'
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
/* -------------------- Export BASE_URL for debugging -------------------- */
export { BASE_URL };

