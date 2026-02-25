// 📡 api.js — Handles all API calls between Expo app and Node.js backend

// 🚀 SERVER CONFIGURATION
// const SERVER_URL = "http://192.168.29.155:5000"; // Local testing
const SERVER_URL = "https://attendancesystemmobile.vercel.app";

const BASE_URL = SERVER_URL.endsWith('/')
    ? SERVER_URL.slice(0, -1)
    : SERVER_URL;

/* -------------------- Helper: Parse JSON Safely -------------------- */
async function handleResponse(res) {
    try {
        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text || "{}");
        } catch (err) {
            console.error("⚠️ JSON parse failed:", err);
            if (text.includes('<html') || text.includes('<!doctype')) {
                return { success: false, msg: "Server returned HTML error page" };
            }
            return { success: false, msg: "Invalid JSON from server" };
        }

        if (!res.ok) {
            return {
                success: false,
                msg: data.message || data.msg || `Server error (${res.status})`,
            };
        }

        return data;
    } catch (err) {
        console.error("❌ Response handler crashed:", err);
        return { success: false, msg: "Network or parsing error" };
    }
}

/* -------------------- 🔐 Login via PIN -------------------- */
export async function loginByPin(pin) {
    try {
        const res = await fetch(`${BASE_URL}/login_pin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin }),
        });
        return await handleResponse(res);
    } catch (err) {
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 🕒 Punch In / Out -------------------- */
export async function punchActionMobile(pin, type, locationData = null) {
    try {
        const requestBody = { pin, type };

        if (locationData) {
            requestBody.location = {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                address: locationData.address
            };
        }

        const res = await fetch(`${BASE_URL}/mobile/punch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        });

        return await handleResponse(res);
    } catch (err) {
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 📅 Fetch History -------------------- */
export async function getHistory(empId) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/history/${empId}`);
        const data = await handleResponse(res);
        
        // Ensure we always return a consistent format
        return {
            attendance: data.attendance || [],
            leaves: data.leaves || []
        };
    } catch (err) {
        console.error("⚠️ History fetch error:", err);
        return { attendance: [], leaves: [] };
    }
}

/* -------------------- 👤 Get Profile -------------------- */
export async function getEmployeeProfile(empCode) {
    try {
        const res = await fetch(`${BASE_URL}/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emp_code: empCode }),
        });
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Profile fetch error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 📝 Apply Leave -------------------- */
export async function applyLeave(empId, leaveType, reason, fromDate = null, toDate = null) {
    try {
        const requestBody = { emp_id: empId, type: leaveType, reason };

        if (leaveType === "custom") {
            requestBody.from_date = fromDate;
            requestBody.to_date = toDate;
        }

        const res = await fetch(`${BASE_URL}/api/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        });

        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Apply leave error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 🔍 Who Am I -------------------- */
export async function getEmployeeByPin(pin) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/whoami/${pin}`);
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ WhoAmI error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 📊 Get Employee Attendance (Simplified - uses history) -------------------- */
export async function getEmployeeAttendance(userId) {
    try {
        console.log("📊 Fetching attendance for user:", userId);
        
        // Directly use history endpoint - this is guaranteed to work
        const historyData = await getHistory(userId);
        
        // Transform the data if needed (your API might return different format)
        const attendance = Array.isArray(historyData.attendance) ? historyData.attendance : [];
        
        console.log(`✅ Found ${attendance.length} attendance records`);
        
        return {
            success: true,
            attendance: attendance
        };
        
    } catch (err) {
        console.error("⚠️ Attendance fetch error:", err);
        // Return empty array on error
        return { 
            success: true, 
            attendance: [],
            msg: "No data available"
        };
    }
}

/* -------------------- 📊 Get Monthly Attendance -------------------- */
export async function getMonthlyAttendance(userId, month, year) {
    try {
        console.log(`📊 Fetching monthly attendance for user ${userId}: ${month}/${year}`);
        
        // First get all attendance
        const data = await getEmployeeAttendance(userId);
        
        if (data.success && data.attendance) {
            // Filter for specific month and year
            const monthlyData = data.attendance.filter(record => {
                if (!record.date) return false;
                const recordDate = new Date(record.date);
                return recordDate.getMonth() === month && 
                       recordDate.getFullYear() === year;
            });
            
            return {
                success: true,
                attendance: monthlyData
            };
        }
        
        return { success: true, attendance: [] };
    } catch (err) {
        console.error("⚠️ Monthly attendance fetch error:", err);
        return { success: true, attendance: [] };
    }
}

/* -------------------- 📊 Get Attendance Statistics -------------------- */
export async function getAttendanceStats(userId) {
    try {
        const data = await getEmployeeAttendance(userId);
        
        if (data.success && data.attendance) {
            const stats = {
                totalDays: data.attendance.length,
                presentDays: data.attendance.filter(d => !d.absent && d.time_in && d.time_out).length,
                leaveDays: data.attendance.filter(d => d.absent === true).length,
            };
            
            return {
                success: true,
                stats
            };
        }
        
        return { success: true, stats: { totalDays: 0, presentDays: 0, leaveDays: 0 } };
    } catch (err) {
        console.error("⚠️ Stats fetch error:", err);
        return { success: true, stats: { totalDays: 0, presentDays: 0, leaveDays: 0 } };
    }
}

/* -------------------- 🖼️ Photo Upload -------------------- */
export const updateProfilePicture = async (userId, imageUri) => {
    try {
        console.log("📤 Updating profile picture for user:", userId);
        
        const formData = new FormData();
        const filename = imageUri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        // Handle iOS file:// protocol
        const uri = Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri;

        formData.append('photo', {
            uri: uri,
            name: filename,
            type: type,
        });

        const response = await fetch(`${BASE_URL}/mobile/employee/${userId}/photo`, {
            method: 'POST',
            body: formData,
            headers: { 
                'Accept': 'application/json',
                'Content-Type': 'multipart/form-data',
            },
        });

        const result = await handleResponse(response);
        console.log("✅ Upload response:", result);
        
        return result;
    } catch (error) {
        console.error("❌ Upload error:", error);
        return { success: false, msg: "Network error during upload" };
    }
};

export const getUserPhoto = async (userId) => {
    try {
        console.log("📥 Fetching photo for user:", userId);
        
        const res = await fetch(`${BASE_URL}/mobile/employee/${userId}/photo`);
        const data = await handleResponse(res);

        if (data.success && data.photoUrl) {
            // Ensure absolute URL
            if (data.photoUrl.startsWith('/')) {
                data.photoUrl = `${BASE_URL}${data.photoUrl}`;
            }
            console.log("✅ Photo URL:", data.photoUrl);
        }

        return data;
    } catch (err) {
        console.error("⚠️ Get photo error:", err);
        return { success: false, msg: "Network connection failed" };
    }
};

export const deleteProfilePicture = async (userId) => {
    try {
        console.log("🗑️ Deleting photo for user:", userId);
        
        const response = await fetch(`${BASE_URL}/mobile/employee/${userId}/photo`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });

        const result = await handleResponse(response);
        console.log("✅ Delete response:", result);
        
        return result;
    } catch (error) {
        console.error("❌ Delete error:", error);
        return { success: false, msg: "Network error while deleting photo" };
    }
};

/* -------------------- 📄 Download Monthly Report PDF -------------------- */
export async function downloadMonthlyReportPDF(employeeId) {
    try {
        const url = `${BASE_URL}/monthly_report/pdf/${employeeId}`;
        console.log("📥 Downloading PDF from:", url);
        
        const response = await fetch(url);

        if (!response.ok) {
            return { success: false, msg: "Failed to generate PDF" };
        }

        const blob = await response.blob();
        const reader = new FileReader();

        return new Promise((resolve) => {
            reader.onloadend = () => {
                const base64data = reader.result.split(',')[1];
                resolve({
                    success: true,
                    base64: base64data
                });
            };
            reader.readAsDataURL(blob);
        });

    } catch (error) {
        console.error("⚠️ PDF download error:", error);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 📱 Device Registration -------------------- */
export async function registerDevice(userId, deviceToken, deviceType) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/device/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                userId, 
                deviceToken, 
                deviceType,
                platform: Platform.OS 
            }),
        });
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Device registration error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 🔔 Notification Settings -------------------- */
export async function updateNotificationSettings(userId, settings) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/notifications/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, settings }),
        });
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Notification settings error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 📍 Location Settings -------------------- */
export async function updateLocationSettings(userId, settings) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/location/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, settings }),
        });
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Location settings error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 📊 Dashboard Statistics -------------------- */
export async function getDashboardStats(userId) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/dashboard/${userId}/stats`);
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Dashboard stats error:", err);
        return { success: false, stats: {}, msg: "Network connection failed" };
    }
}

/* -------------------- 📋 Leave Requests -------------------- */
export async function getLeaveRequests(userId) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/leave/${userId}/requests`);
        const data = await handleResponse(res);
        
        return {
            success: true,
            leaves: data.leaves || []
        };
    } catch (err) {
        console.error("⚠️ Leave requests error:", err);
        return { success: true, leaves: [] };
    }
}

export async function cancelLeaveRequest(leaveId) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/leave/${leaveId}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Cancel leave error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 📊 Report Generation -------------------- */
export async function generateReport(userId, reportType, startDate, endDate) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/reports/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, reportType, startDate, endDate }),
        });
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Report generation error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 📥 Download Report -------------------- */
export async function downloadReport(reportId) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/reports/${reportId}/download`);
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Report download error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 🔄 Sync Offline Data -------------------- */
export async function syncOfflineData(userId, offlineData) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, data: offlineData }),
        });
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Sync error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- ℹ️ App Version Check -------------------- */
export async function checkAppVersion(currentVersion) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/version`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentVersion }),
        });
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Version check error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 🏢 Company Information -------------------- */
export async function getCompanyInfo(companyId) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/company/${companyId}`);
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Company info error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 📅 Holidays -------------------- */
export async function getHolidays(companyId, year) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/holidays/${companyId}/${year}`);
        const data = await handleResponse(res);
        
        return {
            success: true,
            holidays: data.holidays || []
        };
    } catch (err) {
        console.error("⚠️ Holidays fetch error:", err);
        return { success: true, holidays: [] };
    }
}

export { BASE_URL };
