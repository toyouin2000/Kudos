
import axios from "axios";


// =====================================================
// AXIOS CLIENT
// =====================================================

const api = axios.create({

  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://kudos-ij18.onrender.com/api" ,

  withCredentials:
    true,

  headers: {
    "Content-Type":
      "application/json",
  },

});


// =====================================================
// REQUEST INTERCEPTOR
// =====================================================
// Automatically attaches the JWT to every request.
//
// Example:
//
// Authorization: Bearer eyJhbGciOi...
// =====================================================

api.interceptors.request.use(

  (config) => {

    const token =
      localStorage.getItem(
        "token"
      );


    if (token) {

      config.headers =
        config.headers || {};


      config.headers.Authorization =
        `Bearer ${token}`;

    }


    return config;

  },

  (error) => {

    return Promise.reject(
      error
    );

  }

);


// =====================================================
// RESPONSE INTERCEPTOR
// =====================================================
// Handle authentication failures globally.
// =====================================================

api.interceptors.response.use(

  (response) => {

    return response;

  },

  (error) => {

    if (
      error.response?.status ===
      401
    ) {

      console.warn(
        "Authentication expired or invalid."
      );


      localStorage.removeItem(
        "token"
      );

      localStorage.removeItem(
        "user"
      );

      localStorage.removeItem(
        "organizationId"
      );


      // Prevent redirect loop
      if (
        window.location.pathname !==
        "/login"
      ) {

        window.location.href =
          "/login";

      }

    }


    return Promise.reject(
      error
    );

  }

);


// =====================================================
// SEND GIFT CARD / PAYOUT
// =====================================================

export async function sendGiftCard(
  userId
) {

  const response =
    await api.post(
      `/redemptions/${userId}`
    );


  return response.data;

}


// =====================================================
// GET USER REDEMPTIONS
// =====================================================

export async function getUserRedemptions(
  userId
) {

  const response =
    await api.get(
      `/redemptions/user/${userId}`
    );


  return response.data;

}


// =====================================================
// EXPORT
// =====================================================

export default api; 