// 📡 api.js — Handles all API calls between Expo app and Node.js backend

// 🚀 SERVER CONFIGURATION
// Use your local IP (e.g., 192.168.1.10) for testing on a physical device
// Use the Render URL only AFTER you deploy the new Node.js code there
// const SERVER_URL = "http://192.168.29.155:5000";
const SERVER_URL = "https://attendancesystemmobile.vercel.app";

const BASE_URL = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;

/* -------------------- Helper: Parse response safely -------------------- */
async function handleResponse(res) {
    try {
        const text = await res.text();
        

        let data;
        try {
            data = JSON.parse(text || "{}");
        } catch (err) {
            console.error("⚠️ JSON parse failed:", err);
            // If we see HTML tags, it's likely a 404 or crash page from the server
            if (text.includes('<html') || text.includes('<!doctype')) {
                return { success: false, msg: "Server returned an error page (404/500)" };
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

/* -------------------- 🔐 Login via 4-digit PIN -------------------- */
export async function loginByPin(pin) {
    try {
        const res = await fetch(`${BASE_URL}/login_pin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin }),
        });
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ Login network error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 🕒 Punch In / Punch Out -------------------- */
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
        console.error("⚠️ Punch network error:", err);
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 📅 Fetch Employee History -------------------- */
export async function getHistory(empId) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/history/${empId}`);
        return await handleResponse(res);
    } catch (err) {
        console.error("⚠️ History fetch error:", err);
        return { attendance: [], leave: [] };
    }
}

/* -------------------- 👤 Get Employee Profile -------------------- */
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
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 🔍 Who Am I -------------------- */
export async function getEmployeeByPin(pin) {
    try {
        const res = await fetch(`${BASE_URL}/mobile/whoami/${pin}`);
        return await handleResponse(res);
    } catch (err) {
        return { success: false, msg: "Network connection failed" };
    }
}

/* -------------------- 🖼️ User Photo Operations -------------------- */

/**
 * Update Profile Photo
 * @param {number} userId - Numeric ID (id)
 */
export const updateProfilePicture = async (userId, imageUri) => {
    try {
        const formData = new FormData();
        const filename = imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('photo', {
            uri: imageUri,
            name: filename,
            type: type,
        });

        // Explicitly hit the mobile photo endpoint
        const url = `${BASE_URL}/mobile/employee/${userId}/photo`;
        console.log("📤 Uploading photo to:", url);

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json',
            },
        });

        return await handleResponse(response);
    } catch (error) {
        console.error('Upload error:', error);
        return { success: false, msg: "Network error during upload" };
    }
};

/**
 * Get Active Photo URL
 */
export const getUserPhoto = async (userId) => {
    try {
        const url = `${BASE_URL}/mobile/employee/${userId}/photo`;
        console.log("📥 Fetching photo from:", url);

        const res = await fetch(url);
        const data = await handleResponse(res);

        if (data.success && data.photoUrl) {
            if (data.photoUrl.startsWith('/')) {
                data.photoUrl = `${BASE_URL}${data.photoUrl}`;
            }
        }
        return data;
    } catch (err) {
        console.error("⚠️ Get photo error:", err);
        return { success: false, msg: "Network connection failed" };
    }
};

/**
 * DELETE Profile Photo
 * @param {number} userId - Numeric ID (id)
 */
export const deleteProfilePicture = async (userId) => {
    try {
        const url = `${BASE_URL}/mobile/employee/${userId}/photo`;
        console.log("🗑️ Deleting photo from:", url);

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });

        const result = await handleResponse(response);
        console.log("✅ Delete photo response:", result);
        
        return result;
    } catch (error) {
        console.error('❌ Delete photo error:', error);
        return { 
            success: false, 
            msg: "Network error while deleting photo",
            error: error.message 
        };
    }
};

export { BASE_URL };

